import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import rateLimit from 'express-rate-limit';
import { BackupService } from '../services/BackupService.js';
import { ServerService } from '../services/ServerService.js';
import { validate, validateParams } from '../middleware/validation.js';
import {
  createBackupSchema,
  backupIdSchema,
  serverIdSchema,
  updateBackupRetentionSchema,
} from '@deployy/shared';
import { z } from 'zod';
import type { PermissionMiddleware } from '../middleware/permissions.js';
import { AppError } from '../middleware/errorHandler.js';

// Rate limiter for backup creation (5 per hour - backups are resource-intensive)
const backupCreateRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many backup requests. Please wait before creating more backups.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for backup downloads (10 per hour)
const backupDownloadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Too many backup downloads. Please wait before downloading more.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const createBackupsRouter = (
  backupService: BackupService,
  serverService: ServerService,
  permissions: PermissionMiddleware
): Router => {
  const router = Router({ mergeParams: true });

  const getServerId = (req: Request) => req.params.serverId;

  // List backups
  router.get(
    '/',
    permissions.checkServerPermission(getServerId, 'admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const backups = await backupService.listBackups(req.params.serverId);
        const settings = await backupService.getBackupSettings(req.params.serverId);
        res.json({ backups, retention: settings.retention, backupPath: settings.backupPath });
      } catch (error) {
        next(error);
      }
    }
  );

  // Create backup
  router.post(
    '/',
    backupCreateRateLimiter,
    permissions.checkServerPermission(getServerId, 'admin'),
    validate(createBackupSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const backup = await backupService.createBackup(
          req.params.serverId,
          req.body.name
        );
        res.status(201).json(backup);
      } catch (error) {
        next(error);
      }
    }
  );

  // Update retention setting
  router.patch(
    '/retention',
    permissions.checkServerPermission(getServerId, 'admin'),
    validate(updateBackupRetentionSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await backupService.updateRetention(
          req.params.serverId,
          req.body.backupRetention
        );
        res.json({ success: true, backupRetention: req.body.backupRetention });
      } catch (error) {
        next(error);
      }
    }
  );

  // Update backup path
  router.patch(
    '/path',
    permissions.checkServerPermission(getServerId, 'admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { backupPath } = req.body;
        // Allow null/empty to reset to default
        const pathValue = backupPath && backupPath.trim() !== '' ? backupPath.trim() : null;
        await backupService.updateBackupPath(req.params.serverId, pathValue);
        const settings = await backupService.getBackupSettings(req.params.serverId);
        res.json({ success: true, backupPath: settings.backupPath });
      } catch (error) {
        next(error);
      }
    }
  );

  // Download backup
  router.get(
    '/:backupId/download',
    backupDownloadRateLimiter,
    permissions.checkServerPermission(getServerId, 'admin'),
    validateParams(z.object({ serverId: serverIdSchema, backupId: backupIdSchema })),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const backup = await backupService.getBackup(req.params.backupId);
        if (!backup) {
          throw new AppError(404, 'Backup not found');
        }

        if (backup.serverId !== req.params.serverId) {
          throw new AppError(403, 'Backup does not belong to this server');
        }

        // Check if file exists
        try {
          await fs.access(backup.path);
        } catch {
          throw new AppError(404, 'Backup file not found on disk');
        }

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${backup.filename}"`);
        res.setHeader('Content-Length', backup.size);

        const stream = createReadStream(backup.path);
        stream.pipe(res);
      } catch (error) {
        next(error);
      }
    }
  );

  // Restore backup
  router.post(
    '/:backupId/restore',
    permissions.checkServerPermission(getServerId, 'admin'),
    validateParams(z.object({ serverId: serverIdSchema, backupId: backupIdSchema })),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const backup = await backupService.getBackup(req.params.backupId);
        if (!backup) {
          throw new AppError(404, 'Backup not found');
        }

        if (backup.serverId !== req.params.serverId) {
          throw new AppError(403, 'Backup does not belong to this server');
        }

        // Check if server is running
        const isRunning = serverService.isServerRunning(req.params.serverId);
        if (isRunning) {
          throw new AppError(400, 'Server must be stopped before restoring backup');
        }

        await backupService.restoreBackup(req.params.backupId);
        res.json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  // Delete backup
  router.delete(
    '/:backupId',
    permissions.checkServerPermission(getServerId, 'admin'),
    validateParams(z.object({ serverId: serverIdSchema, backupId: backupIdSchema })),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const backup = await backupService.getBackup(req.params.backupId);
        if (!backup) {
          throw new AppError(404, 'Backup not found');
        }

        if (backup.serverId !== req.params.serverId) {
          throw new AppError(403, 'Backup does not belong to this server');
        }

        await backupService.deleteBackup(req.params.backupId);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
};
