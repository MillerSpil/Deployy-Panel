import type { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';
import type { AuthService } from '../services/AuthService.js';
import type { AuthUserWithPermissions } from '@deployy/shared';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthUserWithPermissions;
    }
  }
}

export const createAuthMiddleware = (authService: AuthService) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies?.auth_token;

      if (!token) {
        throw new AppError(401, 'Authentication required');
      }

      const user = await authService.verifyToken(token);
      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Optional auth - doesn't throw, just attaches user if available
export const createOptionalAuthMiddleware = (authService: AuthService) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies?.auth_token;
      if (token) {
        const user = await authService.verifyToken(token);
        req.user = user;
      }
    } catch {
      // Ignore auth errors for optional auth
    }
    next();
  };
};
