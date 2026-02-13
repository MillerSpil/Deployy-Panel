import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { UpdateService } from '../services/UpdateService.js';
import { validate, validateParams } from '../middleware/validation.js';
import type { PermissionMiddleware } from '../middleware/permissions.js';
import { logger } from '../utils/logger.js';

const updateSettingsSchema = z.object({
  autoCheckUpdates: z.boolean().optional(),
  telemetryEnabled: z.boolean().optional(),
});

// SECURITY: Only allow GitHub releases from the official repository
const ALLOWED_DOWNLOAD_ORIGINS = [
  'https://github.com/MillerSpil/Deployy-Panel/',
  'https://codeload.github.com/MillerSpil/Deployy-Panel/',
  'https://api.github.com/repos/MillerSpil/Deployy-Panel/',
];

const applyUpdateSchema = z.object({
  downloadUrl: z
    .string()
    .url()
    .refine(
      (url) => ALLOWED_DOWNLOAD_ORIGINS.some((origin) => url.startsWith(origin)),
      'Download URL must be from the official Deployy Panel GitHub repository'
    ),
  targetVersion: z.string().regex(/^\d+\.\d+\.\d+$/, 'Invalid version format'),
});

const backupIdSchema = z.object({
  backupId: z.string().uuid('Invalid backup ID format'),
});

export function createUpdateRouter(
  updateService: UpdateService,
  permissions: PermissionMiddleware
): Router {
  const router = Router();

  // GET /api/update/status - Check for updates and get current version
  router.get(
    '/status',
    permissions.requireAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const updateInfo = await updateService.checkForUpdates();
        res.json(updateInfo);
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/update/version - Get current version only (no GitHub check)
  router.get(
    '/version',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const version = updateService.getCurrentVersion();
        res.json({ version });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/update/settings - Get panel settings
  router.get(
    '/settings',
    permissions.requireAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const settings = await updateService.getSettings();
        res.json(settings);
      } catch (error) {
        next(error);
      }
    }
  );

  // PATCH /api/update/settings - Update panel settings
  router.patch(
    '/settings',
    permissions.requireAdmin,
    validate(updateSettingsSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const settings = await updateService.updateSettings(req.body);
        res.json(settings);
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/update/apply - Start the update process
  router.post(
    '/apply',
    permissions.requireAdmin,
    validate(applyUpdateSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (updateService.isUpdateInProgress()) {
          res.status(409).json({ error: 'Update already in progress' });
          return;
        }

        const { downloadUrl, targetVersion } = req.body;

        // Start update in background
        updateService.performUpdate(downloadUrl, targetVersion).catch((error) => {
          logger.error('Update failed', { error });
        });

        res.json({ success: true, message: 'Update started' });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/update/backups - List all update backups
  router.get(
    '/backups',
    permissions.requireAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const backups = await updateService.listBackups();
        res.json(backups);
      } catch (error) {
        next(error);
      }
    }
  );

  // DELETE /api/update/backups/:backupId - Delete a backup
  router.delete(
    '/backups/:backupId',
    permissions.requireAdmin,
    validateParams(backupIdSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await updateService.deleteBackup(req.params.backupId);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/update/rollback/:backupId - Rollback to a backup
  router.post(
    '/rollback/:backupId',
    permissions.requireAdmin,
    validateParams(backupIdSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (updateService.isUpdateInProgress()) {
          res.status(409).json({ error: 'Cannot rollback while update is in progress' });
          return;
        }

        // Start rollback in background
        updateService.rollback(req.params.backupId).catch((error) => {
          logger.error('Rollback failed', { error });
        });

        res.json({ success: true, message: 'Rollback started' });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
