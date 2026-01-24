import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { ServerAccessService } from '../services/ServerAccessService.js';
import { validate, validateParams } from '../middleware/validation.js';
import {
  grantServerAccessSchema,
  updateServerAccessSchema,
  serverIdSchema,
  serverAccessIdSchema,
  transferOwnershipSchema,
} from '@deployy/shared';
import { z } from 'zod';
import type { PermissionMiddleware } from '../middleware/permissions.js';

export const createServerAccessRouter = (
  accessService: ServerAccessService,
  permissions: PermissionMiddleware
): Router => {
  const router = Router({ mergeParams: true }); // Access :serverId from parent router

  const getServerId = (req: Request) => req.params.serverId;

  // List server access entries
  router.get(
    '/',
    permissions.checkServerOwnerOrAdmin(getServerId),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const entries = await accessService.listServerAccess(req.params.serverId);
        res.json(entries);
      } catch (error) {
        next(error);
      }
    }
  );

  // Grant access
  router.post(
    '/',
    permissions.checkServerOwnerOrAdmin(getServerId),
    validate(grantServerAccessSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const access = await accessService.grantAccess({
          userId: req.body.userId,
          serverId: req.params.serverId,
          permissionLevel: req.body.permissionLevel,
        });
        res.status(201).json(access);
      } catch (error) {
        next(error);
      }
    }
  );

  // Update access level
  router.patch(
    '/:accessId',
    permissions.checkServerOwnerOrAdmin(getServerId),
    validateParams(z.object({ serverId: serverIdSchema, accessId: serverAccessIdSchema })),
    validate(updateServerAccessSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const access = await accessService.updateAccess(
          req.params.accessId,
          req.body.permissionLevel
        );
        res.json(access);
      } catch (error) {
        next(error);
      }
    }
  );

  // Revoke access
  router.delete(
    '/:accessId',
    permissions.checkServerOwnerOrAdmin(getServerId),
    validateParams(z.object({ serverId: serverIdSchema, accessId: serverAccessIdSchema })),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await accessService.revokeAccess(req.params.accessId);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );

  // Transfer ownership
  router.post(
    '/transfer-ownership',
    permissions.checkServerOwnerOrAdmin(getServerId),
    validate(transferOwnershipSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await accessService.transferOwnership(
          req.params.serverId,
          req.body.newOwnerId,
          req.user!.id
        );
        res.json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
};
