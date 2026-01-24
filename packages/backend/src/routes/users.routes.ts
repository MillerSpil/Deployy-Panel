import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/UserService.js';
import { validate, validateParams } from '../middleware/validation.js';
import { createUserSchema, updateUserSchema, userIdSchema } from '@deployy/shared';
import { z } from 'zod';
import type { PermissionMiddleware } from '../middleware/permissions.js';

export const createUsersRouter = (
  userService: UserService,
  permissions: PermissionMiddleware
): Router => {
  const router = Router();

  // List all users
  router.get(
    '/',
    permissions.requireUsersView,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const users = await userService.listUsers();
        res.json(users);
      } catch (error) {
        next(error);
      }
    }
  );

  // Get single user
  router.get(
    '/:id',
    permissions.requireUsersView,
    validateParams(z.object({ id: userIdSchema })),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = await userService.getUser(req.params.id);
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
      } catch (error) {
        next(error);
      }
    }
  );

  // Create user
  router.post(
    '/',
    permissions.requireUsersCreate,
    validate(createUserSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = await userService.createUser(req.body);
        res.status(201).json(user);
      } catch (error) {
        next(error);
      }
    }
  );

  // Update user
  router.patch(
    '/:id',
    permissions.requireUsersEdit,
    validateParams(z.object({ id: userIdSchema })),
    validate(updateUserSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = await userService.updateUser(req.params.id, req.body, req.user!.id);
        res.json(user);
      } catch (error) {
        next(error);
      }
    }
  );

  // Delete user
  router.delete(
    '/:id',
    permissions.requireUsersDelete,
    validateParams(z.object({ id: userIdSchema })),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await userService.deleteUser(req.params.id, req.user!.id);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
};
