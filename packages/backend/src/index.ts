import express from 'express';
import { createServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { logger } from './utils/logger.js';
import { ServerService } from './services/ServerService.js';
import { AuthService } from './services/AuthService.js';
import { PermissionService } from './services/PermissionService.js';
import { RoleService } from './services/RoleService.js';
import { UserService } from './services/UserService.js';
import { ServerAccessService } from './services/ServerAccessService.js';
import { createServerRouter } from './routes/servers.routes.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createRolesRouter } from './routes/roles.routes.js';
import { createUsersRouter } from './routes/users.routes.js';
import { createServerAccessRouter } from './routes/serverAccess.routes.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { createPermissionMiddleware } from './middleware/permissions.js';
import { setupWebSocketHandlers } from './websocket/handlers.js';
import { errorHandler } from './middleware/errorHandler.js';
import type { ClientToServerEvents, ServerToClientEvents } from '@deployy/shared';

const PORT = process.env.PORT || 3000;
const SERVERS_BASE_PATH = process.env.SERVERS_BASE_PATH || './servers';

async function main() {
  const prisma = new PrismaClient();
  await prisma.$connect();
  logger.info('Database connected');

  // Initialize services
  const serverService = new ServerService(prisma, SERVERS_BASE_PATH);
  const authService = new AuthService(prisma);
  const permissionService = new PermissionService(prisma);
  const roleService = new RoleService(prisma);
  const userService = new UserService(prisma);
  const accessService = new ServerAccessService(prisma);

  const app = express();
  const httpServer = createServer(app);

  // Support multiple frontend ports for development
  const FRONTEND_URLS = (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((url) => url.trim());

  const corsOrigin = FRONTEND_URLS.length === 1 ? FRONTEND_URLS[0] : FRONTEND_URLS;

  const io = new SocketServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  serverService.setSocketServer(io);
  setupWebSocketHandlers(io, serverService, authService, permissionService);

  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP',
  });
  app.use('/api', limiter);

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Auth routes (public)
  app.use('/api/auth', createAuthRouter(authService));

  // Protected routes setup
  const requireAuth = createAuthMiddleware(authService);
  const permissions = createPermissionMiddleware(permissionService);

  // Server routes with permission filtering
  app.use(
    '/api/servers',
    requireAuth,
    createServerRouter(serverService, permissionService, accessService, permissions)
  );

  // Server access routes (nested under servers)
  app.use(
    '/api/servers/:serverId/access',
    requireAuth,
    createServerAccessRouter(accessService, permissions)
  );

  // Admin routes
  app.use('/api/roles', requireAuth, createRolesRouter(roleService, permissions));
  app.use('/api/users', requireAuth, createUsersRouter(userService, permissions));

  app.use(errorHandler);

  httpServer.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });

  const shutdown = async () => {
    logger.info('Shutting down gracefully...');

    httpServer.close(() => {
      logger.info('HTTP server closed');
    });

    await prisma.$disconnect();
    logger.info('Database disconnected');

    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  logger.error('Fatal error during startup', { error });
  process.exit(1);
});
