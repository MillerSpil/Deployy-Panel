import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { FileService } from '../services/FileService.js';
import { validate } from '../middleware/validation.js';
import {
  listFilesSchema,
  readFileSchema,
  writeFileSchema,
  createFileSchema,
  deleteFileSchema,
  renameFileSchema,
} from '@deployy/shared';
import type { PermissionMiddleware } from '../middleware/permissions.js';
import { AppError } from '../middleware/errorHandler.js';

// Rate limiter for resource-intensive file operations (30 requests per minute)
const fileOpsRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: { error: 'Too many file operations, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiter for downloads/uploads (10 per minute)
const fileTransferRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Too many file transfers, please wait before downloading/uploading more files' },
  standardHeaders: true,
  legacyHeaders: false,
});

// SECURITY: Zod schema for path query parameter validation
const pathQuerySchema = z
  .string()
  .default('')
  .refine((p) => !p.includes('..'), 'Path cannot contain ".."');

// SECURITY: Sanitize uploaded filename - remove path separators and dangerous characters
function sanitizeFilename(filename: string): string {
  // Remove path separators and null bytes
  let sanitized = filename.replace(/[/\\:\x00]/g, '_');
  // Remove leading dots (prevents hidden files and directory traversal)
  sanitized = sanitized.replace(/^\.+/, '');
  // Remove any remaining dangerous characters
  sanitized = sanitized.replace(/[<>"|?*]/g, '_');
  // Ensure not empty
  if (!sanitized || sanitized === '_') {
    sanitized = 'uploaded_file';
  }
  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.lastIndexOf('.');
    if (ext > 0) {
      const name = sanitized.slice(0, ext);
      const extension = sanitized.slice(ext);
      sanitized = name.slice(0, 255 - extension.length) + extension;
    } else {
      sanitized = sanitized.slice(0, 255);
    }
  }
  return sanitized;
}

// Configure multer for file uploads (store in memory, 50MB limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1,
  },
});

export const createFilesRouter = (
  fileService: FileService,
  permissions: PermissionMiddleware
): Router => {
  const router = Router({ mergeParams: true });

  const getServerId = (req: Request) => req.params.serverId;

  // List files in directory
  router.get(
    '/',
    permissions.checkServerPermission(getServerId, 'admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // SECURITY: Validate query param with Zod
        const parseResult = pathQuerySchema.safeParse(req.query.path);
        if (!parseResult.success) {
          throw new AppError(400, parseResult.error.errors[0]?.message || 'Invalid path');
        }
        const dirPath = parseResult.data;
        const files = await fileService.listFiles(req.params.serverId, dirPath);
        res.json({ files, path: dirPath });
      } catch (error) {
        next(error);
      }
    }
  );

  // Read file content
  router.get(
    '/read',
    fileOpsRateLimiter,
    permissions.checkServerPermission(getServerId, 'admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // SECURITY: Validate query param with Zod
        const parseResult = z.string().min(1, 'File path is required').refine(
          (p) => !p.includes('..'),
          'Path cannot contain ".."'
        ).safeParse(req.query.path);
        if (!parseResult.success) {
          throw new AppError(400, parseResult.error.errors[0]?.message || 'Invalid path');
        }
        const filePath = parseResult.data;
        const content = await fileService.readFile(req.params.serverId, filePath);
        res.json(content);
      } catch (error) {
        next(error);
      }
    }
  );

  // Write file content
  router.put(
    '/write',
    fileOpsRateLimiter,
    permissions.checkServerPermission(getServerId, 'admin'),
    validate(writeFileSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await fileService.writeFile(req.params.serverId, req.body.path, req.body.content);
        res.json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  // Create new file or directory
  router.post(
    '/create',
    permissions.checkServerPermission(getServerId, 'admin'),
    validate(createFileSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const file = await fileService.createFile(
          req.params.serverId,
          req.body.path,
          req.body.type
        );
        res.status(201).json(file);
      } catch (error) {
        next(error);
      }
    }
  );

  // Delete file or directory
  router.delete(
    '/delete',
    permissions.checkServerPermission(getServerId, 'admin'),
    validate(deleteFileSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await fileService.deleteFile(req.params.serverId, req.body.path);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );

  // Rename file or directory
  router.patch(
    '/rename',
    permissions.checkServerPermission(getServerId, 'admin'),
    validate(renameFileSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const file = await fileService.renameFile(
          req.params.serverId,
          req.body.oldPath,
          req.body.newName
        );
        res.json(file);
      } catch (error) {
        next(error);
      }
    }
  );

  // Download file
  router.get(
    '/download',
    fileTransferRateLimiter,
    permissions.checkServerPermission(getServerId, 'admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // SECURITY: Validate query param with Zod
        const parseResult = z.string().min(1, 'File path is required').refine(
          (p) => !p.includes('..'),
          'Path cannot contain ".."'
        ).safeParse(req.query.path);
        if (!parseResult.success) {
          throw new AppError(400, parseResult.error.errors[0]?.message || 'Invalid path');
        }
        const filePath = parseResult.data;

        const { fullPath, filename, size } = await fileService.getDownloadPath(
          req.params.serverId,
          filePath
        );

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        res.setHeader('Content-Length', size);

        const stream = fileService.createReadStream(fullPath);
        stream.pipe(res);
      } catch (error) {
        next(error);
      }
    }
  );

  // Upload file
  router.post(
    '/upload',
    fileTransferRateLimiter,
    permissions.checkServerPermission(getServerId, 'admin'),
    upload.single('file'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) {
          throw new AppError(400, 'No file provided');
        }

        // SECURITY: Validate and sanitize inputs
        const targetPathResult = pathQuerySchema.safeParse(req.body.targetPath);
        if (!targetPathResult.success) {
          throw new AppError(400, targetPathResult.error.errors[0]?.message || 'Invalid target path');
        }
        const targetPath = targetPathResult.data;

        // SECURITY: Sanitize uploaded filename
        const safeFilename = sanitizeFilename(req.file.originalname);

        const file = await fileService.handleUpload(
          req.params.serverId,
          targetPath,
          safeFilename,
          req.file.buffer
        );

        res.status(201).json(file);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
};
