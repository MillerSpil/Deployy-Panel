import type { Server as SocketServer } from 'socket.io';
import type { ServerService } from '../services/ServerService.js';
import type { ClientToServerEvents, ServerToClientEvents } from '@deployy/shared';
import { logger } from '../utils/logger.js';

export const setupWebSocketHandlers = (
  io: SocketServer<ClientToServerEvents, ServerToClientEvents>,
  serverService: ServerService
) => {
  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    socket.on('subscribe:server', ({ serverId }) => {
      logger.info(`Client ${socket.id} subscribing to server ${serverId}`);

      const adapter = serverService.getAdapter(serverId);
      if (!adapter) {
        socket.emit('error', {
          message: 'Server not found or not running',
          code: 'SERVER_NOT_FOUND',
        });
        return;
      }

      socket.join(`server:${serverId}`);

      const logHandler = (line: string) => {
        socket.emit('server:log', {
          serverId,
          line,
          timestamp: new Date().toISOString(),
        });
      };

      const statusHandler = (status: string) => {
        socket.emit('server:status', { serverId, status });
      };

      adapter.on('log', logHandler);
      adapter.on('status', statusHandler);

      socket.on('disconnect', () => {
        adapter.off('log', logHandler);
        adapter.off('status', statusHandler);
      });
    });

    socket.on('unsubscribe:server', ({ serverId }) => {
      socket.leave(`server:${serverId}`);
      logger.info(`Client ${socket.id} unsubscribed from server ${serverId}`);
    });

    socket.on('command', async ({ serverId, command }) => {
      try {
        const adapter = serverService.getAdapter(serverId);
        if (!adapter) {
          socket.emit('error', {
            message: 'Server not found or not running',
            code: 'SERVER_NOT_FOUND',
          });
          return;
        }

        if (!command || command.length > 500) {
          socket.emit('error', {
            message: 'Invalid command',
            code: 'INVALID_COMMAND',
          });
          return;
        }

        logger.info(`Sending command to server ${serverId}: ${command}`);

        const sent = adapter.sendCommand(command);
        if (!sent) {
          socket.emit('error', {
            message: 'Failed to send command - server stdin not available',
            code: 'COMMAND_FAILED',
          });
        }
      } catch (error) {
        logger.error(`Error handling command: ${error}`);
        socket.emit('error', {
          message: 'Failed to execute command',
          code: 'COMMAND_FAILED',
        });
      }
    });

    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });
};
