import type { Server as SocketServer } from 'socket.io';
import cookie from 'cookie';
import type { ServerService } from '../services/ServerService.js';
import type { AuthService } from '../services/AuthService.js';
import type { PermissionService } from '../services/PermissionService.js';
import type { ClientToServerEvents, ServerToClientEvents, AuthUserWithPermissions } from '@deployy/shared';
import { logger } from '../utils/logger.js';

// Socket data type
interface SocketData {
  user?: AuthUserWithPermissions;
}

export const setupWebSocketHandlers = (
  io: SocketServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>,
  serverService: ServerService,
  authService: AuthService,
  permissionService: PermissionService
) => {
  // Socket.IO middleware for authentication
  io.use(async (socket, next) => {
    try {
      const cookies = cookie.parse(socket.handshake.headers.cookie || '');
      const token = cookies.auth_token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const user = await authService.verifyToken(token);
      socket.data.user = user;
      next();
    } catch (error) {
      logger.warn('Socket auth failed');
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`, { userId: socket.data.user?.id });

    socket.on('subscribe:server', async ({ serverId }) => {
      logger.info(`Client ${socket.id} subscribing to server ${serverId}`);

      // Check viewer access before allowing subscription
      const hasAccess = await permissionService.hasServerPermission(
        socket.data.user!.id,
        serverId,
        'viewer'
      );

      if (!hasAccess) {
        socket.emit('error', {
          message: 'Access denied to this server',
          code: 'ACCESS_DENIED',
        });
        return;
      }

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
        // Check operator access before allowing commands
        const hasAccess = await permissionService.hasServerPermission(
          socket.data.user!.id,
          serverId,
          'operator'
        );

        if (!hasAccess) {
          socket.emit('error', {
            message: 'Insufficient permissions to send commands',
            code: 'ACCESS_DENIED',
          });
          return;
        }

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
