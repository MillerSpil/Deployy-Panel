import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { SchedulerService } from '../services/SchedulerService.js';
import { validate, validateParams } from '../middleware/validation.js';
import {
  createScheduledTaskSchema,
  updateScheduledTaskSchema,
  scheduledTaskIdSchema,
  serverIdSchema,
} from '@deployy/shared';
import { z } from 'zod';
import type { PermissionMiddleware } from '../middleware/permissions.js';
import { AppError } from '../middleware/errorHandler.js';

export const createSchedulesRouter = (
  schedulerService: SchedulerService,
  permissions: PermissionMiddleware
): Router => {
  const router = Router({ mergeParams: true });

  const getServerId = (req: Request) => req.params.serverId;

  // List scheduled tasks
  router.get(
    '/',
    permissions.checkServerPermission(getServerId, 'admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tasks = await schedulerService.listTasks(req.params.serverId);
        res.json(tasks);
      } catch (error) {
        next(error);
      }
    }
  );

  // Get single task
  router.get(
    '/:taskId',
    permissions.checkServerPermission(getServerId, 'admin'),
    validateParams(z.object({ serverId: serverIdSchema, taskId: scheduledTaskIdSchema })),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const task = await schedulerService.getTask(req.params.taskId);
        if (!task) {
          throw new AppError(404, 'Scheduled task not found');
        }

        if (task.serverId !== req.params.serverId) {
          throw new AppError(403, 'Task does not belong to this server');
        }

        res.json(task);
      } catch (error) {
        next(error);
      }
    }
  );

  // Create scheduled task
  router.post(
    '/',
    permissions.checkServerPermission(getServerId, 'admin'),
    validate(createScheduledTaskSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const task = await schedulerService.createTask(req.params.serverId, req.body);
        res.status(201).json(task);
      } catch (error) {
        next(error);
      }
    }
  );

  // Update scheduled task
  router.patch(
    '/:taskId',
    permissions.checkServerPermission(getServerId, 'admin'),
    validateParams(z.object({ serverId: serverIdSchema, taskId: scheduledTaskIdSchema })),
    validate(updateScheduledTaskSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const existing = await schedulerService.getTask(req.params.taskId);
        if (!existing) {
          throw new AppError(404, 'Scheduled task not found');
        }

        if (existing.serverId !== req.params.serverId) {
          throw new AppError(403, 'Task does not belong to this server');
        }

        const task = await schedulerService.updateTask(req.params.taskId, req.body);
        res.json(task);
      } catch (error) {
        next(error);
      }
    }
  );

  // Toggle task enabled/disabled
  router.post(
    '/:taskId/toggle',
    permissions.checkServerPermission(getServerId, 'admin'),
    validateParams(z.object({ serverId: serverIdSchema, taskId: scheduledTaskIdSchema })),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const existing = await schedulerService.getTask(req.params.taskId);
        if (!existing) {
          throw new AppError(404, 'Scheduled task not found');
        }

        if (existing.serverId !== req.params.serverId) {
          throw new AppError(403, 'Task does not belong to this server');
        }

        const task = await schedulerService.toggleTask(req.params.taskId, !existing.enabled);
        res.json(task);
      } catch (error) {
        next(error);
      }
    }
  );

  // Delete scheduled task
  router.delete(
    '/:taskId',
    permissions.checkServerPermission(getServerId, 'admin'),
    validateParams(z.object({ serverId: serverIdSchema, taskId: scheduledTaskIdSchema })),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const existing = await schedulerService.getTask(req.params.taskId);
        if (!existing) {
          throw new AppError(404, 'Scheduled task not found');
        }

        if (existing.serverId !== req.params.serverId) {
          throw new AppError(403, 'Task does not belong to this server');
        }

        await schedulerService.deleteTask(req.params.taskId);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
};
