import type { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';
import type { PermissionService } from '../services/PermissionService.js';
import type { PanelPermission, ServerPermissionLevel, AuthUserWithPermissions } from '@deployy/shared';

// Extend Express Request to use AuthUserWithPermissions
declare global {
  namespace Express {
    interface Request {
      user?: AuthUserWithPermissions;
    }
  }
}

export const createPermissionMiddleware = (permissionService: PermissionService) => {
  /**
   * Middleware to check panel-level permission.
   */
  const checkPanelPermission = (permission: PanelPermission) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          throw new AppError(401, 'Authentication required');
        }

        const hasPermission = await permissionService.hasPanelPermission(req.user.id, permission);

        if (!hasPermission) {
          throw new AppError(403, `Permission denied: ${permission}`);
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  };

  /**
   * Middleware to check server-level permission.
   * @param getServerId - Function to extract server ID from request (e.g., from params)
   * @param requiredLevel - Minimum permission level required
   */
  const checkServerPermission = (
    getServerId: (req: Request) => string,
    requiredLevel: ServerPermissionLevel
  ) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          throw new AppError(401, 'Authentication required');
        }

        const serverId = getServerId(req);
        const hasPermission = await permissionService.hasServerPermission(
          req.user.id,
          serverId,
          requiredLevel
        );

        if (!hasPermission) {
          throw new AppError(403, 'Insufficient server permissions');
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  };

  /**
   * Middleware to check if user can access a server (viewer level).
   */
  const checkServerAccess = (getServerId: (req: Request) => string) => {
    return checkServerPermission(getServerId, 'viewer');
  };

  /**
   * Middleware to check if user is server owner or panel admin.
   */
  const checkServerOwnerOrAdmin = (getServerId: (req: Request) => string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          throw new AppError(401, 'Authentication required');
        }

        const serverId = getServerId(req);

        // Check if panel admin
        const isAdmin = await permissionService.hasPanelPermission(req.user.id, 'panel.admin');
        if (isAdmin) return next();

        // Check if server owner
        const hasOwner = await permissionService.hasServerPermission(req.user.id, serverId, 'owner');
        if (hasOwner) return next();

        throw new AppError(403, 'Only server owners or admins can perform this action');
      } catch (error) {
        next(error);
      }
    };
  };

  // Shorthand middlewares for common permission checks
  const requireAdmin = checkPanelPermission('panel.admin');
  const requireUsersView = checkPanelPermission('users.view');
  const requireUsersCreate = checkPanelPermission('users.create');
  const requireUsersEdit = checkPanelPermission('users.edit');
  const requireUsersDelete = checkPanelPermission('users.delete');
  const requireRolesView = checkPanelPermission('roles.view');
  const requireRolesCreate = checkPanelPermission('roles.create');
  const requireRolesEdit = checkPanelPermission('roles.edit');
  const requireRolesDelete = checkPanelPermission('roles.delete');
  const requireServersCreate = checkPanelPermission('servers.create');

  return {
    checkPanelPermission,
    checkServerPermission,
    checkServerAccess,
    checkServerOwnerOrAdmin,
    requireAdmin,
    requireUsersView,
    requireUsersCreate,
    requireUsersEdit,
    requireUsersDelete,
    requireRolesView,
    requireRolesCreate,
    requireRolesEdit,
    requireRolesDelete,
    requireServersCreate,
  };
};

export type PermissionMiddleware = ReturnType<typeof createPermissionMiddleware>;
