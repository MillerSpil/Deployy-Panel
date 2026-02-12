import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { MinecraftVersionService } from '../services/MinecraftVersionService.js';
import { AuthService } from '../services/AuthService.js';
import { createAuthMiddleware } from '../middleware/auth.js';

export const createMinecraftRouter = (
  versionService: MinecraftVersionService,
  authService: AuthService
): Router => {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);

  // Get Vanilla Minecraft versions
  router.get(
    '/versions/vanilla',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const includeSnapshots = req.query.snapshots === 'true';
        const versions = await versionService.getVanillaVersions(includeSnapshots);
        res.json({ versions });
      } catch (error) {
        next(error);
      }
    }
  );

  // Get Paper versions
  router.get(
    '/versions/paper',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const versions = await versionService.getPaperVersions();
        res.json({ versions });
      } catch (error) {
        next(error);
      }
    }
  );

  // Get latest version for a flavor
  router.get(
    '/versions/latest/:flavor',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const flavor = req.params.flavor as 'vanilla' | 'paper';
        if (flavor !== 'vanilla' && flavor !== 'paper') {
          res.status(400).json({ error: 'Invalid flavor. Must be vanilla or paper.' });
          return;
        }
        const version = await versionService.getLatestVersion(flavor);
        res.json({ version });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
};
