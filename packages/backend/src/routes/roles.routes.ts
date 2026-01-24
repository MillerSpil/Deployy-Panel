import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { RoleService } from '../services/RoleService.js';
import { validate, validateParams } from '../middleware/validation.js';
import { createRoleSchema, updateRoleSchema, roleIdSchema } from '@deployy/shared';
import { z } from 'zod';
import type { PermissionMiddleware } from '../middleware/permissions.js';

export const createRolesRouter = (
  roleService: RoleService,
  permissions: PermissionMiddleware
): Router => {
  const router = Router();

  // List all roles
  router.get(
    '/',
    permissions.requireRolesView,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const roles = await roleService.listRoles();
        res.json(roles);
      } catch (error) {
        next(error);
      }
    }
  );

  // Get single role
  router.get(
    '/:id',
    permissions.requireRolesView,
    validateParams(z.object({ id: roleIdSchema })),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const role = await roleService.getRole(req.params.id);
        if (!role) {
          return res.status(404).json({ error: 'Role not found' });
        }
        res.json(role);
      } catch (error) {
        next(error);
      }
    }
  );

  // Create role
  router.post(
    '/',
    permissions.requireRolesCreate,
    validate(createRoleSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const role = await roleService.createRole(req.body);
        res.status(201).json(role);
      } catch (error) {
        next(error);
      }
    }
  );

  // Update role
  router.patch(
    '/:id',
    permissions.requireRolesEdit,
    validateParams(z.object({ id: roleIdSchema })),
    validate(updateRoleSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const role = await roleService.updateRole(req.params.id, req.body);
        res.json(role);
      } catch (error) {
        next(error);
      }
    }
  );

  // Delete role
  router.delete(
    '/:id',
    permissions.requireRolesDelete,
    validateParams(z.object({ id: roleIdSchema })),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await roleService.deleteRole(req.params.id);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
};
