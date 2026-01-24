import { PrismaClient } from '@prisma/client';
import type { Server as SocketServer } from 'socket.io';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Server, InstallConfig, ServerToClientEvents, ClientToServerEvents, GameConfig } from '@deployy/shared';
import { AdapterFactory } from '../adapters/AdapterFactory.js';
import { BaseAdapter } from '../adapters/BaseAdapter.js';
import { PathValidator } from '../utils/paths.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

export class ServerService {
  private adapters: Map<string, BaseAdapter> = new Map();
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
  }): Promise<Server> {
    const serverPath = data.path;

    if (serverPath.includes('..')) {
      throw new Error('Invalid path: directory traversal not allowed');
    }

    const server = await this.prisma.server.create({
      data: {
        name: data.name,
        gameType: data.gameType,
        port: data.port,
        maxPlayers: data.maxPlayers,
        version: data.version,
        path: serverPath,
        config: JSON.stringify({}),
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
      };

      const result = await adapter.install(installConfig);

      if (!result.success) {
        await this.prisma.server.delete({ where: { id: server.id } });
        throw new Error(result.error || 'Installation failed');
      }

      logger.info(`Server created: ${server.id} at ${serverPath}`);
      return this.transformServer(server);
    } catch (error) {
      await this.prisma.server.delete({ where: { id: server.id } });
      throw error;
    }
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
    const server = await this.prisma.server.findUnique({ where: { id } });
    if (!server) {
      throw new AppError(404, 'Server not found');
    }

    const configPath = path.join(server.path, 'config.json');

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new AppError(404, 'Config file not found');
      }
      throw new AppError(500, 'Failed to read config file');
    }
  }

  async updateServerConfig(id: string, config: GameConfig): Promise<GameConfig> {
    const server = await this.prisma.server.findUnique({ where: { id } });
    if (!server) {
      throw new AppError(404, 'Server not found');
    }

    const configPath = path.join(server.path, 'config.json');

    try {
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
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
    return {
      ...server,
      config: typeof server.config === 'string' ? JSON.parse(server.config) : server.config,
    };
  }
}
