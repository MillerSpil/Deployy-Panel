import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
import { BackupService } from './services/BackupService.js';
import { FileService } from './services/FileService.js';
import { SchedulerService } from './services/SchedulerService.js';
import { UpdateService } from './services/UpdateService.js';
import { TelemetryService } from './services/TelemetryService.js';
import { createServerRouter } from './routes/servers.routes.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createRolesRouter } from './routes/roles.routes.js';
import { createUsersRouter } from './routes/users.routes.js';
import { createServerAccessRouter } from './routes/serverAccess.routes.js';
import { createBackupsRouter } from './routes/backups.routes.js';
import { createFilesRouter } from './routes/files.routes.js';
import { createSchedulesRouter } from './routes/schedules.routes.js';
import { createUpdateRouter } from './routes/update.routes.js';
import { createMinecraftRouter } from './routes/minecraft.routes.js';
import { MinecraftVersionService } from './services/MinecraftVersionService.js';
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
  const backupService = new BackupService(prisma);
  const fileService = new FileService(prisma);
  const schedulerService = new SchedulerService(prisma);
  const updateService = new UpdateService(prisma);
  const minecraftVersionService = new MinecraftVersionService();
  const telemetryService = new TelemetryService(prisma);
  telemetryService.setDependencies({ updateService });

  // Set scheduler dependencies and initialize
  schedulerService.setDependencies({
    serverService,
    backupService,
  });
  await schedulerService.initialize();

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

  // Wire up update progress events to WebSocket
  updateService.on('progress', (progress) => {
    io.emit('update:progress', progress);
  });

  // SECURITY: Configure helmet with Content Security Policy
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for React
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'"],
          connectSrc: ["'self'", 'ws:', 'wss:'], // Allow WebSocket connections
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false, // Disable for development compatibility
    })
  );
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
    max: 1000,
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
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

  // Backup routes (nested under servers)
  app.use(
    '/api/servers/:serverId/backups',
    requireAuth,
    createBackupsRouter(backupService, serverService, permissions)
  );

  // File manager routes (nested under servers)
  app.use(
    '/api/servers/:serverId/files',
    requireAuth,
    createFilesRouter(fileService, permissions)
  );

  // Scheduled tasks routes (nested under servers)
  app.use(
    '/api/servers/:serverId/schedules',
    requireAuth,
    createSchedulesRouter(schedulerService, permissions)
  );

  // Admin routes
  app.use('/api/roles', requireAuth, createRolesRouter(roleService, permissions));
  app.use('/api/users', requireAuth, createUsersRouter(userService, permissions));

  // Update routes (mostly admin-only, but version endpoint is public)
  app.use('/api/update', requireAuth, createUpdateRouter(updateService, permissions));

  // Minecraft version routes
  app.use('/api/minecraft', createMinecraftRouter(minecraftVersionService, authService));

  // Serve frontend static files in production
  if (process.env.NODE_ENV === 'production') {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const frontendPath = path.join(__dirname, '../../frontend/dist');

    app.use(express.static(frontendPath));

    // SPA fallback - serve index.html for all non-API routes
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendPath, 'index.html'));
    });
  }

  app.use(errorHandler);

  httpServer.listen(PORT, async () => {
    logger.info(`Server running on http://localhost:${PORT}`);

    // Auto-check for updates on startup if enabled
    try {
      const settings = await updateService.getSettings();
      if (settings.autoCheckUpdates) {
        logger.info('Auto-checking for updates...');
        updateService.checkForUpdates().catch((err) => {
          logger.warn('Auto update check failed', { error: err.message });
        });
      }
    } catch (err) {
      logger.warn('Failed to check update settings', { error: err });
    }

    // Initialize telemetry (first ping + 24h interval)
    await telemetryService.initialize();
  });

  const shutdown = async () => {
    logger.info('Shutting down gracefully...');

    // Stop all scheduled tasks
    await schedulerService.shutdown();
    logger.info('Scheduler stopped');

    // Stop telemetry
    await telemetryService.shutdown();
    logger.info('Telemetry stopped');

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

// Prevent silent crashes from unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', { reason, promise: String(promise) });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception - process will continue but may be unstable', { error: error.message, stack: error.stack });
});

main().catch((error) => {
  logger.error('Fatal error during startup', { error });
  process.exit(1);
});
