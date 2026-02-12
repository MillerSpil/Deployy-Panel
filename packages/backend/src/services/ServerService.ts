import { PrismaClient } from '@prisma/client';
import type { Server as SocketServer } from 'socket.io';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Server, InstallConfig, ServerToClientEvents, ClientToServerEvents, GameConfig, HytaleDownloadStatus } from '@deployy/shared';
import { AdapterFactory } from '../adapters/AdapterFactory.js';
import { BaseAdapter } from '../adapters/BaseAdapter.js';
import { PathValidator } from '../utils/paths.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { HytaleDownloadService } from './HytaleDownloadService.js';

export class ServerService {
  private adapters: Map<string, BaseAdapter> = new Map();
  private activeDownloads: Map<string, HytaleDownloadService> = new Map();
  private pathValidator: PathValidator;
  private io: SocketServer<ClientToServerEvents, ServerToClientEvents> | null = null;

  constructor(
    private prisma: PrismaClient,
    private serversBasePath: string
  ) {
    this.pathValidator = new PathValidator(serversBasePath);
  }

  setSocketServer(io: SocketServer<ClientToServerEvents, ServerToClientEvents>) {
    this.io = io;
  }

  private broadcastStatus(serverId: string, status: string) {
    if (this.io) {
      this.io.emit('server:status', { serverId, status });
    }
  }

  private broadcastLog(serverId: string, line: string) {
    if (this.io) {
      this.io.emit('server:log', { serverId, line, timestamp: new Date().toISOString() });
    }
  }

  async listServers(): Promise<Server[]> {
    const servers = await this.prisma.server.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return servers.map(this.transformServer);
  }

  async listServersByIds(ids: string[]): Promise<Server[]> {
    if (ids.length === 0) return [];

    const servers = await this.prisma.server.findMany({
      where: { id: { in: ids } },
      orderBy: { createdAt: 'desc' },
    });

    return servers.map(this.transformServer);
  }

  async getServer(id: string): Promise<Server | null> {
    const server = await this.prisma.server.findUnique({ where: { id } });
    return server ? this.transformServer(server) : null;
  }

  async createServer(data: {
    name: string;
    gameType: string;
    path: string;
    port: number;
    maxPlayers: number;
    version?: string;
    flavor?: string;
    ram?: number;
  }): Promise<Server> {
    const serverPath = data.path;

    if (serverPath.includes('..')) {
      throw new AppError(400, 'Invalid path: directory traversal not allowed');
    }

    // Check if a server with the same port already exists
    const existingServer = await this.prisma.server.findFirst({
      where: { port: data.port },
    });

    if (existingServer) {
      throw new AppError(409, `Port ${data.port} is already in use by server "${existingServer.name}"`);
    }

    // Build config JSON with game-specific settings
    const serverConfig: Record<string, unknown> = {};
    if (data.ram) {
      serverConfig.ram = data.ram;
    }
    if (data.gameType === 'minecraft') {
      serverConfig.flavor = data.flavor || 'paper';
      serverConfig.version = data.version || 'latest';
    }

    const server = await this.prisma.server.create({
      data: {
        name: data.name,
        gameType: data.gameType,
        port: data.port,
        maxPlayers: data.maxPlayers,
        version: data.version,
        path: serverPath,
        config: JSON.stringify(serverConfig),
      },
    });

    try {
      const adapter = AdapterFactory.create({
        ...this.transformServer(server),
        path: serverPath,
      });
      const installConfig: InstallConfig = {
        name: data.name,
        port: data.port,
        maxPlayers: data.maxPlayers,
        version: data.version,
        installPath: serverPath,
        ram: data.ram as any,
        flavor: data.flavor as any,
      };

      const result = await adapter.install(installConfig);

      if (!result.success) {
        await this.prisma.server.delete({ where: { id: server.id } });
        throw new Error(result.error || 'Installation failed');
      }

      // Update version if the adapter resolved 'latest' to a specific version
      if (result.version && result.version !== data.version) {
        await this.prisma.server.update({
          where: { id: server.id },
          data: { version: result.version },
        });
      }

      logger.info(`Server created: ${server.id} at ${serverPath}`);
      return this.transformServer(server);
    } catch (error) {
      await this.prisma.server.delete({ where: { id: server.id } });
      throw error;
    }
  }

  async startHytaleDownload(serverId: string): Promise<void> {
    const server = await this.prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new AppError(404, 'Server not found');
    }

    if (server.gameType !== 'hytale') {
      throw new AppError(400, 'Auto-download is only available for Hytale servers');
    }

    if (this.activeDownloads.has(serverId)) {
      throw new AppError(409, 'Download already in progress');
    }

    const downloadService = new HytaleDownloadService(server.path);
    this.activeDownloads.set(serverId, downloadService);

    // Wire up events
    downloadService.on('progress', (progress: { status: HytaleDownloadStatus; message: string; authUrl?: string }) => {
      logger.info('Download progress event received', { serverId, status: progress.status, hasIo: !!this.io });
      if (this.io) {
        this.io.emit('hytale:download:progress', {
          serverId,
          status: progress.status,
          message: progress.message,
          authUrl: progress.authUrl,
        });
        logger.info('Emitted hytale:download:progress via WebSocket');
      } else {
        logger.warn('No socket.io instance available!');
      }

      // Cleanup on completion or error
      if (progress.status === 'completed' || progress.status === 'error') {
        this.activeDownloads.delete(serverId);
      }
    });

    downloadService.on('log', (line: string) => {
      if (this.io) {
        this.io.emit('hytale:download:log', {
          serverId,
          line,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Start download in background (don't await)
    downloadService.download().catch((error) => {
      logger.error('Hytale download failed', { serverId, error });
      this.activeDownloads.delete(serverId);
    });

    logger.info(`Started Hytale download for server ${serverId}`);
  }

  cancelHytaleDownload(serverId: string): boolean {
    const download = this.activeDownloads.get(serverId);
    if (download) {
      download.abort();
      this.activeDownloads.delete(serverId);
      logger.info(`Cancelled Hytale download for server ${serverId}`);
      return true;
    }
    return false;
  }

  async startMinecraftUpdate(serverId: string, targetVersion?: string): Promise<void> {
    const server = await this.getServer(serverId);
    if (!server) {
      throw new AppError(404, 'Server not found');
    }

    if (server.gameType !== 'minecraft') {
      throw new AppError(400, 'Updates via this method are only available for Minecraft servers');
    }

    // Check if server is running or already updating
    const existingAdapter = this.adapters.get(serverId);
    if (existingAdapter?.isRunning()) {
      throw new AppError(409, 'Server must be stopped before updating');
    }
    if (existingAdapter?.isUpdating) {
      throw new AppError(409, 'An update is already in progress for this server');
    }

    // Use the existing adapter if available (it holds the lock state),
    // otherwise create a new one
    const updateAdapter = existingAdapter || AdapterFactory.create(server);

    // Wire up progress events with proper typing
    updateAdapter.on('update:progress', (progress: { status: string; message: string }) => {
      if (this.io) {
        this.io.emit('minecraft:download:progress', {
          serverId,
          status: progress.status as 'checking_version' | 'downloading' | 'completed' | 'error',
          message: progress.message,
        });
      }
    });

    // Start update in background
    updateAdapter.update(targetVersion).then(async (result) => {
      if (result.success && result.version) {
        // Update version in database
        await this.prisma.server.update({
          where: { id: serverId },
          data: { version: result.version },
        });
        logger.info(`Minecraft server ${serverId} updated to ${result.version}`);
      }
    }).catch((error) => {
      logger.error('Minecraft update failed', { serverId, error });
    });

    logger.info(`Started Minecraft update for server ${serverId}`);
  }

  async deleteServer(id: string): Promise<void> {
    const server = await this.prisma.server.findUnique({ where: { id } });
    if (!server) {
      throw new Error('Server not found');
    }

    const adapter = this.adapters.get(id);
    if (adapter?.isRunning()) {
      await adapter.stop();
    }

    this.adapters.delete(id);

    // Delete server folder from filesystem BEFORE removing from database
    // This ensures we still have the path info if deletion fails
    if (server.path) {
      try {
        // Normalize the path for cross-platform compatibility
        const normalizedPath = server.path.replace(/\//g, path.sep);
        logger.info(`Attempting to delete server folder: ${normalizedPath}`);

        // Check if path exists before trying to delete
        try {
          await fs.access(normalizedPath);
          await fs.rm(normalizedPath, { recursive: true, force: true });
          logger.info(`Server folder deleted successfully: ${normalizedPath}`);
        } catch (accessError: any) {
          if (accessError.code === 'ENOENT') {
            logger.info(`Server folder already deleted or never existed: ${normalizedPath}`);
          } else {
            throw accessError;
          }
        }
      } catch (error) {
        logger.error('Failed to delete server folder', { error, path: server.path });
        // Don't throw - continue with database deletion
      }
    }

    await this.prisma.server.delete({ where: { id } });
    logger.info(`Server deleted from database: ${id}`);
  }

  async startServer(id: string): Promise<void> {
    const server = await this.getServer(id);
    if (!server) throw new Error('Server not found');

    const adapter = this.getOrCreateAdapter(server);
    await adapter.start();

    await this.prisma.server.update({
      where: { id },
      data: { status: 'running' },
    });
  }

  async stopServer(id: string): Promise<void> {
    const adapter = this.adapters.get(id);
    if (!adapter) throw new Error('Server not running');

    await adapter.stop();

    await this.prisma.server.update({
      where: { id },
      data: { status: 'stopped' },
    });
  }

  async restartServer(id: string): Promise<void> {
    await this.stopServer(id);
    await this.startServer(id);
  }

  getAdapter(id: string): BaseAdapter | undefined {
    return this.adapters.get(id);
  }

  async getServerConfig(id: string): Promise<GameConfig> {
    const server = await this.getServer(id);
    if (!server) {
      throw new AppError(404, 'Server not found');
    }

    try {
      // Use adapter to get config (handles different formats per game type)
      const adapter = AdapterFactory.create(server);
      return await adapter.getConfig();
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new AppError(404, 'Config file not found');
      }
      logger.error('Failed to read server config', { error, serverId: id });
      throw new AppError(500, 'Failed to read config file');
    }
  }

  async updateServerConfig(id: string, config: GameConfig): Promise<GameConfig> {
    const server = await this.getServer(id);
    if (!server) {
      throw new AppError(404, 'Server not found');
    }

    try {
      // Use adapter to update config (handles different formats per game type)
      const adapter = AdapterFactory.create(server);
      await adapter.updateConfig(config);
      logger.info('Server config updated', { serverId: id });
      return config;
    } catch (error) {
      logger.error('Failed to update server config', { error, serverId: id });
      throw new AppError(500, 'Failed to write config file');
    }
  }

  isServerRunning(id: string): boolean {
    const adapter = this.adapters.get(id);
    return adapter?.isRunning() ?? false;
  }

  private getOrCreateAdapter(server: Server): BaseAdapter {
    let adapter = this.adapters.get(server.id);

    if (!adapter) {
      adapter = AdapterFactory.create(server);
      this.adapters.set(server.id, adapter);

      adapter.on('status', (status) => {
        this.prisma.server
          .update({
            where: { id: server.id },
            data: { status },
          })
          .then(() => {
            this.broadcastStatus(server.id, status);
          })
          .catch((error) => logger.error(`Failed to update server status: ${error}`));
      });

      adapter.on('log', (line) => {
        this.broadcastLog(server.id, line);
      });
    }

    return adapter;
  }

  private transformServer(server: any): Server {
    let config = server.config;
    if (typeof config === 'string') {
      try {
        config = JSON.parse(config);
      } catch (err) {
        logger.error(`Failed to parse config JSON for server ${server.id}`, { config, error: err });
        config = {};
      }
    }
    return {
      ...server,
      config: config ?? {},
    };
  }
}
