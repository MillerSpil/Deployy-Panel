import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { ServerService } from '../services/ServerService.js';
import { validate, validateParams } from '../middleware/validation.js';
import {
  createServerSchema,
  updateServerSchema,
  serverIdSchema,
  serverCommandSchema,
} from '@deployy/shared';
import { z } from 'zod';

export const createServerRouter = (serverService: ServerService) => {
  const router = Router();

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const servers = await serverService.listServers();
      res.json(servers);
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/',
    validate(createServerSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const server = await serverService.createServer(req.body);
        res.status(201).json(server);
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    '/:id',
    validateParams(z.object({ id: serverIdSchema })),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const server = await serverService.getServer(req.params.id);
        if (!server) {
          return res.status(404).json({ error: 'Server not found' });
        }
        res.json(server);
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete(
    '/:id',
    validateParams(z.object({ id: serverIdSchema })),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await serverService.deleteServer(req.params.id);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/:id/start',
    validateParams(z.object({ id: serverIdSchema })),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await serverService.startServer(req.params.id);
        res.json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/:id/stop',
    validateParams(z.object({ id: serverIdSchema })),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await serverService.stopServer(req.params.id);
        res.json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/:id/restart',
    validateParams(z.object({ id: serverIdSchema })),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await serverService.restartServer(req.params.id);
        res.json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    '/:id/status',
    validateParams(z.object({ id: serverIdSchema })),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const adapter = serverService.getAdapter(req.params.id);
        if (!adapter) {
          return res.status(404).json({ error: 'Server not running' });
        }

        const status = adapter.getStatus();
        const metrics = await adapter.getMetrics();

        res.json({ status, metrics });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    '/:id/logs',
    validateParams(z.object({ id: serverIdSchema })),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const adapter = serverService.getAdapter(req.params.id);
        if (!adapter) {
          return res.json({ logs: [] });
        }

        const logs = adapter.getLogBuffer();
        res.json({ logs });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
};
