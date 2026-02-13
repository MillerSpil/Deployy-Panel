import { PrismaClient } from '@prisma/client';
import os from 'node:os';
import fs from 'node:fs';
import https from 'node:https';
import crypto from 'node:crypto';
import { logger } from '../utils/logger.js';
import type { PanelSettings } from '@deployy/shared';

// Supabase configuration (public anon key — INSERT-only via RLS)
// Replace these with your actual Supabase project values
const SUPABASE_URL = 'https://fycivdosccaqixdozgha.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_EM0_LD9jVQslcNEx17FpGQ_8wd1QbOF';
const TELEMETRY_TABLE = 'telemetry_pings';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

interface TelemetryPayload {
  install_id: string;
  version: string;
  environment: string;
  os: string;
  arch: string;
  node_version: string;
  deployment: string;
  servers_total: number;
  servers_running: number;
  servers_by_game: Record<string, number>;
  user_count: number;
  scheduled_tasks: number;
  backups: number;
  server_access_entries: number;
  system_memory_gb: number;
  cpu_cores: number;
  uptime_seconds: number;
}

interface UpdateServiceDeps {
  getSettings(): Promise<PanelSettings>;
  updateSettings(settings: Partial<PanelSettings>): Promise<PanelSettings>;
  getCurrentVersion(): string;
}

export class TelemetryService {
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private updateService: UpdateServiceDeps | null = null;

  constructor(private prisma: PrismaClient) {}

  setDependencies(deps: { updateService: UpdateServiceDeps }): void {
    this.updateService = deps.updateService;
  }

  async initialize(): Promise<void> {
    // Send first ping on startup (non-blocking)
    this.sendPing().catch(() => {});

    // Schedule every 24 hours
    this.intervalHandle = setInterval(() => {
      this.sendPing().catch(() => {});
    }, TWENTY_FOUR_HOURS_MS);
  }

  async shutdown(): Promise<void> {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private async sendPing(): Promise<void> {
    try {
      // Environment variable override (highest priority)
      const envEnabled = process.env.TELEMETRY_ENABLED?.toLowerCase();
      if (envEnabled !== undefined && ['false', '0', 'no', 'off'].includes(envEnabled)) {
        logger.debug('Telemetry disabled via environment variable');
        return;
      }

      if (!this.updateService) {
        logger.debug('Telemetry: dependencies not set, skipping');
        return;
      }

      // Check panel settings
      const settings = await this.updateService.getSettings();
      if (!settings.telemetryEnabled) {
        logger.debug('Telemetry disabled via panel settings');
        return;
      }

      // Ensure installId exists
      const installId = await this.ensureInstallId(settings);

      // Collect and send payload
      const payload = await this.collectPayload(installId);
      await this.postToSupabase(payload);

      logger.debug('Telemetry ping sent successfully');
    } catch (err) {
      // Fail silently — telemetry must never break the panel
      logger.debug('Telemetry ping failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async ensureInstallId(settings: PanelSettings): Promise<string> {
    if (settings.installId) {
      return settings.installId;
    }

    const installId = crypto.randomUUID();
    await this.updateService!.updateSettings({ installId } as Partial<PanelSettings>);
    logger.info('Generated new telemetry install ID');
    return installId;
  }

  private async collectPayload(installId: string): Promise<TelemetryPayload> {
    const version = this.updateService!.getCurrentVersion();

    const serversTotal = await this.prisma.server.count();

    const serversRunning = await this.prisma.server.count({
      where: { status: 'running' },
    });

    const serversByGame = await this.prisma.server.groupBy({
      by: ['gameType'],
      _count: { id: true },
    });
    const serversByGameMap: Record<string, number> = {};
    for (const group of serversByGame) {
      serversByGameMap[group.gameType] = group._count.id;
    }

    const userCount = await this.prisma.user.count();
    const scheduledTasks = await this.prisma.scheduledTask.count();
    const backups = await this.prisma.backup.count();
    const serverAccessEntries = await this.prisma.serverAccess.count();

    return {
      install_id: installId,
      version,
      environment: process.env.NODE_ENV || 'development',
      os: os.platform(),
      arch: os.arch(),
      node_version: process.version.replace(/^v/, ''),
      deployment: this.detectDeployment(),
      servers_total: serversTotal,
      servers_running: serversRunning,
      servers_by_game: serversByGameMap,
      user_count: userCount,
      scheduled_tasks: scheduledTasks,
      backups,
      server_access_entries: serverAccessEntries,
      system_memory_gb: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
      cpu_cores: os.cpus().length,
      uptime_seconds: Math.floor(process.uptime()),
    };
  }

  private detectDeployment(): string {
    // Check environment variable (set in Dockerfile / docker-compose)
    if (process.env.DOCKER_CONTAINER === 'true') {
      return 'docker';
    }

    // Check for /.dockerenv file (Linux Docker containers)
    try {
      fs.accessSync('/.dockerenv');
      return 'docker';
    } catch {
      // Not in Docker
    }

    // Check cgroup (Linux Docker containers)
    try {
      const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf-8');
      if (cgroup.includes('docker') || cgroup.includes('containerd')) {
        return 'docker';
      }
    } catch {
      // Not Linux or not in Docker
    }

    return 'standalone';
  }

  private postToSupabase(payload: TelemetryPayload): Promise<void> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(payload);
      const url = new URL(`/rest/v1/${TELEMETRY_TABLE}`, SUPABASE_URL);

      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=minimal',
        },
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk: string) => {
          body += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`Supabase responded with ${res.statusCode}: ${body}`));
          }
        });
      });

      req.on('error', reject);

      // 10 second timeout
      req.setTimeout(10000, () => {
        req.destroy(new Error('Telemetry request timed out'));
      });

      req.write(data);
      req.end();
    });
  }
}
