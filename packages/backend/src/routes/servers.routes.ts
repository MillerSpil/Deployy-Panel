import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { ServerService } from '../services/ServerService.js';
import { PermissionService } from '../services/PermissionService.js';
import { ServerAccessService } from '../services/ServerAccessService.js';
import { validate, validateParams } from '../middleware/validation.js';
import {
  createServerSchema,
  updateServerSchema,
  serverIdSchema,
  serverCommandSchema,
} from '@deployy/shared';
import { z } from 'zod';
import type { PermissionMiddleware } from '../middleware/permissions.js';

export const createServerRouter = (
  serverService: ServerService,
  permissionService: PermissionService,
  accessService: ServerAccessService,
  permissions: PermissionMiddleware
): Router => {
  const router = Router();

  const getServerId = (req: Request) => req.params.id;

  // List servers (filtered by user's access)
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accessibleIds = await permissionService.getAccessibleServerIds(req.user!.id);

      let servers;
      if (accessibleIds === 'all') {
        servers = await serverService.listServers();
      } else {
        servers = await serverService.listServersByIds(accessibleIds);
      }

      res.json(servers);
    } catch (error) {
      next(error);
    }
  });

  // Create server (requires servers.create permission)
  router.post(
    '/',
    permissions.requireServersCreate,
    validate(createServerSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const server = await serverService.createServer(req.body);
        // Auto-grant owner access to creator
        await accessService.grantOwnerOnCreate(req.user!.id, server.id);
        res.status(201).json(server);
      } catch (error) {
        next(error);
      }
    }
  );

  // Get single server
  router.get(
    '/:id',
    validateParams(z.object({ id: serverIdSchema })),
    permissions.checkServerAccess(getServerId),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const server = await serverService.getServer(req.params.id);
        if (!server) {
          return res.status(404).json({ error: 'Server not found' });
        }

        // Include user's permission level for this server
        const userPermissionLevel = await permissionService.getServerPermissionLevel(
          req.user!.id,
          req.params.id
        );

        res.json({ ...server, userPermissionLevel });
      } catch (error) {
        next(error);
      }
    }
  );

  // Delete server (requires owner)
  router.delete(
    '/:id',
    validateParams(z.object({ id: serverIdSchema })),
    permissions.checkServerPermission(getServerId, 'owner'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await serverService.deleteServer(req.params.id);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );

  // Start server (requires operator)
  router.post(
    '/:id/start',
    validateParams(z.object({ id: serverIdSchema })),
    permissions.checkServerPermission(getServerId, 'operator'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await serverService.startServer(req.params.id);
        res.json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  // Stop server (requires operator)
  router.post(
    '/:id/stop',
    validateParams(z.object({ id: serverIdSchema })),
    permissions.checkServerPermission(getServerId, 'operator'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await serverService.stopServer(req.params.id);
        res.json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  // Restart server (requires operator)
  router.post(
    '/:id/restart',
    validateParams(z.object({ id: serverIdSchema })),
    permissions.checkServerPermission(getServerId, 'operator'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await serverService.restartServer(req.params.id);
        res.json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  // Get status (requires viewer)
  router.get(
    '/:id/status',
    validateParams(z.object({ id: serverIdSchema })),
    permissions.checkServerAccess(getServerId),
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

  // Get logs (requires viewer)
  router.get(
    '/:id/logs',
    validateParams(z.object({ id: serverIdSchema })),
    permissions.checkServerAccess(getServerId),
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
