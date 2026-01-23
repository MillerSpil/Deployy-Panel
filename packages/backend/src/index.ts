import express from 'express';
import { createServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { logger } from './utils/logger.js';
import { ServerService } from './services/ServerService.js';
import { createServerRouter } from './routes/servers.routes.js';
import { setupWebSocketHandlers } from './websocket/handlers.js';
import { errorHandler } from './middleware/errorHandler.js';
import type { ClientToServerEvents, ServerToClientEvents } from '@deployy/shared';

const PORT = process.env.PORT || 3000;
const SERVERS_BASE_PATH = process.env.SERVERS_BASE_PATH || './servers';

async function main() {
  const prisma = new PrismaClient();
  await prisma.$connect();
  logger.info('Database connected');

  const serverService = new ServerService(prisma, SERVERS_BASE_PATH);

  const app = express();
  const httpServer = createServer(app);

  const io = new SocketServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  serverService.setSocketServer(io);
  setupWebSocketHandlers(io, serverService);

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    })
  );
  app.use(express.json());

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP',
  });
  app.use('/api', limiter);

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/servers', createServerRouter(serverService));

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
  logger.error({ error }, 'Fatal error during startup');
  process.exit(1);
});
