import { PrismaClient } from '@prisma/client';
import cron, { ScheduledTask as CronTask } from 'node-cron';
import type {
  ScheduledTask,
  ScheduledTaskType,
  ScheduleId,
  ScheduledTaskConfig,
  SCHEDULE_OPTIONS,
} from '@deployy/shared';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

// Map schedule IDs to cron expressions
const SCHEDULE_CRON_MAP: Record<ScheduleId, string> = {
  every_1h: '0 * * * *',
  every_3h: '0 */3 * * *',
  every_6h: '0 */6 * * *',
  every_12h: '0 */12 * * *',
  'daily_00:00': '0 0 * * *',
  'daily_03:00': '0 3 * * *',
  'daily_06:00': '0 6 * * *',
  'daily_12:00': '0 12 * * *',
  'daily_18:00': '0 18 * * *',
  weekly_sunday: '0 0 * * 0',
  weekly_monday: '0 0 * * 1',
};

interface ServiceDependencies {
  serverService: {
    restartServer: (serverId: string) => Promise<void>;
    getServer: (id: string) => Promise<any>;
    getAdapter: (id: string) => any;
  };
  backupService: {
    createBackup: (serverId: string, name?: string) => Promise<any>;
  };
}

export class SchedulerService {
  private activeTasks: Map<string, CronTask> = new Map();
  private dependencies: ServiceDependencies | null = null;

  constructor(private prisma: PrismaClient) {}

  setDependencies(deps: ServiceDependencies) {
    this.dependencies = deps;
  }

  async initialize(): Promise<void> {
    // Load all enabled tasks from database and schedule them
    const tasks = await this.prisma.scheduledTask.findMany({
      where: { enabled: true },
    });

    logger.info(`Loading ${tasks.length} scheduled tasks`);

    for (const task of tasks) {
      this.scheduleTask(this.transformTask(task));
    }
  }

  async shutdown(): Promise<void> {
    // Stop all scheduled tasks
    for (const [taskId, cronTask] of this.activeTasks) {
      cronTask.stop();
      logger.info('Stopped scheduled task', { taskId });
    }
    this.activeTasks.clear();
  }

  async listTasks(serverId: string): Promise<ScheduledTask[]> {
    const tasks = await this.prisma.scheduledTask.findMany({
      where: { serverId },
      orderBy: { createdAt: 'desc' },
    });

    return tasks.map(this.transformTask);
  }

  async getTask(id: string): Promise<ScheduledTask | null> {
    const task = await this.prisma.scheduledTask.findUnique({ where: { id } });
    return task ? this.transformTask(task) : null;
  }

  async createTask(
    serverId: string,
    data: {
      type: ScheduledTaskType;
      schedule: ScheduleId;
      enabled?: boolean;
      config?: ScheduledTaskConfig;
    }
  ): Promise<ScheduledTask> {
    // Verify server exists
    const server = await this.prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new AppError(404, 'Server not found');
    }

    // Validate config based on type
    if (data.type === 'command' && (!data.config?.command || data.config.command.trim() === '')) {
      throw new AppError(400, 'Command is required for command-type tasks');
    }

    const nextRun = this.calculateNextRun(data.schedule);

    const task = await this.prisma.scheduledTask.create({
      data: {
        serverId,
        type: data.type,
        schedule: data.schedule,
        enabled: data.enabled ?? true,
        config: JSON.stringify(data.config || {}),
        nextRun,
      },
    });

    const transformedTask = this.transformTask(task);

    // Schedule if enabled
    if (transformedTask.enabled) {
      this.scheduleTask(transformedTask);
    }

    logger.info('Scheduled task created', { taskId: task.id, type: data.type, schedule: data.schedule });

    return transformedTask;
  }

  async updateTask(
    id: string,
    data: {
      schedule?: ScheduleId;
      enabled?: boolean;
      config?: ScheduledTaskConfig;
    }
  ): Promise<ScheduledTask> {
    const existing = await this.prisma.scheduledTask.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, 'Scheduled task not found');
    }

    // Validate config if type is command
    if (existing.type === 'command' && data.config && (!data.config.command || data.config.command.trim() === '')) {
      throw new AppError(400, 'Command is required for command-type tasks');
    }

    // Stop existing cron job if running
    this.unscheduleTask(id);

    const updateData: any = {};
    if (data.schedule !== undefined) {
      updateData.schedule = data.schedule;
      updateData.nextRun = this.calculateNextRun(data.schedule);
    }
    if (data.enabled !== undefined) {
      updateData.enabled = data.enabled;
    }
    if (data.config !== undefined) {
      updateData.config = JSON.stringify(data.config);
    }

    const task = await this.prisma.scheduledTask.update({
      where: { id },
      data: updateData,
    });

    const transformedTask = this.transformTask(task);

    // Reschedule if enabled
    if (transformedTask.enabled) {
      this.scheduleTask(transformedTask);
    }

    logger.info('Scheduled task updated', { taskId: id });

    return transformedTask;
  }

  async deleteTask(id: string): Promise<void> {
    const task = await this.prisma.scheduledTask.findUnique({ where: { id } });
    if (!task) {
      throw new AppError(404, 'Scheduled task not found');
    }

    // Stop cron job if running
    this.unscheduleTask(id);

    await this.prisma.scheduledTask.delete({ where: { id } });

    logger.info('Scheduled task deleted', { taskId: id });
  }

  async toggleTask(id: string, enabled: boolean): Promise<ScheduledTask> {
    return this.updateTask(id, { enabled });
  }

  private scheduleTask(task: ScheduledTask): void {
    const cronExpression = SCHEDULE_CRON_MAP[task.schedule];
    if (!cronExpression) {
      logger.error('Invalid schedule ID', { taskId: task.id, schedule: task.schedule });
      return;
    }

    const cronTask = cron.schedule(cronExpression, async () => {
      await this.executeTask(task.id);
    });

    this.activeTasks.set(task.id, cronTask);
    logger.info('Task scheduled', { taskId: task.id, schedule: task.schedule, cron: cronExpression });
  }

  private unscheduleTask(taskId: string): void {
    const cronTask = this.activeTasks.get(taskId);
    if (cronTask) {
      cronTask.stop();
      this.activeTasks.delete(taskId);
      logger.info('Task unscheduled', { taskId });
    }
  }

  private async executeTask(taskId: string): Promise<void> {
    if (!this.dependencies) {
      logger.error('SchedulerService dependencies not set');
      return;
    }

    const task = await this.prisma.scheduledTask.findUnique({
      where: { id: taskId },
      include: { server: true },
    });

    if (!task || !task.enabled) {
      logger.warn('Task not found or disabled, skipping execution', { taskId });
      return;
    }

    logger.info('Executing scheduled task', { taskId, type: task.type, serverId: task.serverId });

    try {
      const config = JSON.parse(task.config || '{}') as ScheduledTaskConfig;

      switch (task.type) {
        case 'restart':
          await this.dependencies.serverService.restartServer(task.serverId);
          logger.info('Scheduled restart completed', { taskId, serverId: task.serverId });
          break;

        case 'backup':
          await this.dependencies.backupService.createBackup(task.serverId, config.backupName);
          logger.info('Scheduled backup completed', { taskId, serverId: task.serverId });
          break;

        case 'command':
          if (config.command) {
            const adapter = this.dependencies.serverService.getAdapter(task.serverId);
            if (adapter && adapter.isRunning()) {
              adapter.sendCommand(config.command);
              logger.info('Scheduled command sent', { taskId, serverId: task.serverId, command: config.command });
            } else {
              logger.warn('Server not running, skipping command', { taskId, serverId: task.serverId });
            }
          }
          break;

        default:
          logger.error('Unknown task type', { taskId, type: task.type });
      }

      // Update lastRun and nextRun
      const nextRun = this.calculateNextRun(task.schedule as ScheduleId);
      await this.prisma.scheduledTask.update({
        where: { id: taskId },
        data: {
          lastRun: new Date(),
          nextRun,
        },
      });
    } catch (error) {
      logger.error('Failed to execute scheduled task', { taskId, type: task.type, error });
    }
  }

  private calculateNextRun(schedule: ScheduleId): Date {
    const now = new Date();
    const cronExpression = SCHEDULE_CRON_MAP[schedule];

    // Parse the schedule to calculate next run
    // Format: minute hour day month weekday
    const parts = cronExpression.split(' ');
    const [minute, hour, , , weekday] = parts;

    const next = new Date(now);
    next.setSeconds(0);
    next.setMilliseconds(0);

    if (schedule.startsWith('every_')) {
      // Interval-based schedules
      const hoursMatch = schedule.match(/every_(\d+)h/);
      if (hoursMatch) {
        const interval = parseInt(hoursMatch[1], 10);
        next.setMinutes(0);
        const currentHour = now.getHours();
        const nextHour = Math.ceil((currentHour + 1) / interval) * interval;
        if (nextHour >= 24) {
          next.setDate(next.getDate() + 1);
          next.setHours(nextHour % 24);
        } else {
          next.setHours(nextHour);
        }
      }
    } else if (schedule.startsWith('daily_')) {
      // Daily at specific time
      const targetHour = parseInt(hour, 10);
      const targetMinute = parseInt(minute, 10);
      next.setHours(targetHour);
      next.setMinutes(targetMinute);
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
    } else if (schedule.startsWith('weekly_')) {
      // Weekly on specific day
      const targetWeekday = parseInt(weekday, 10);
      const daysUntil = (targetWeekday - now.getDay() + 7) % 7 || 7;
      next.setDate(now.getDate() + daysUntil);
      next.setHours(0);
      next.setMinutes(0);
    }

    return next;
  }

  private transformTask(task: any): ScheduledTask {
    return {
      id: task.id,
      serverId: task.serverId,
      type: task.type as ScheduledTaskType,
      schedule: task.schedule as ScheduleId,
      enabled: task.enabled,
      config: JSON.parse(task.config || '{}'),
      lastRun: task.lastRun,
      nextRun: task.nextRun,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }
}
