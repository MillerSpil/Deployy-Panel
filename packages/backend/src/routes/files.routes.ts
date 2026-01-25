import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
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
        const dirPath = (req.query.path as string) || '';
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
    permissions.checkServerPermission(getServerId, 'admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const filePath = req.query.path as string;
        if (!filePath) {
          throw new AppError(400, 'File path is required');
        }
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
    permissions.checkServerPermission(getServerId, 'admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const filePath = req.query.path as string;
        if (!filePath) {
          throw new AppError(400, 'File path is required');
        }

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
    permissions.checkServerPermission(getServerId, 'admin'),
    upload.single('file'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) {
          throw new AppError(400, 'No file provided');
        }

        const targetPath = (req.body.targetPath as string) || '';
        const file = await fileService.handleUpload(
          req.params.serverId,
          targetPath,
          req.file.originalname,
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
