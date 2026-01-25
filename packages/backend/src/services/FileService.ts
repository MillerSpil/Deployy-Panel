import { PrismaClient } from '@prisma/client';
import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import type { FileInfo, FileContent } from '@deployy/shared';
import { BINARY_EXTENSIONS } from '@deployy/shared';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

export class FileService {
  constructor(private prisma: PrismaClient) {}

  private async getServerBasePath(serverId: string): Promise<string> {
    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
      select: { path: true },
    });

    if (!server) {
      throw new AppError(404, 'Server not found');
    }

    return server.path;
  }

  private validateAndResolvePath(serverBasePath: string, userPath: string): string {
    // Normalize the path and resolve it
    const normalizedPath = userPath.replace(/\\/g, '/').replace(/^\/+/, '');
    const fullPath = path.join(serverBasePath, normalizedPath);
    const resolvedPath = path.resolve(fullPath);
    const resolvedBase = path.resolve(serverBasePath);

    // Security: Ensure path stays within server directory
    if (!resolvedPath.startsWith(resolvedBase)) {
      logger.warn('Path traversal attempt detected', { userPath, resolvedPath, resolvedBase });
      throw new AppError(403, 'Access denied: Path traversal detected');
    }

    return resolvedPath;
  }

  private getExtension(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    return ext;
  }

  private isBinaryFile(filename: string): boolean {
    const ext = this.getExtension(filename);
    return BINARY_EXTENSIONS.includes(ext as any);
  }

  async listFiles(serverId: string, dirPath: string = ''): Promise<FileInfo[]> {
    const serverBasePath = await this.getServerBasePath(serverId);
    const fullPath = this.validateAndResolvePath(serverBasePath, dirPath);

    // Check if directory exists
    try {
      const stat = await fs.stat(fullPath);
      if (!stat.isDirectory()) {
        throw new AppError(400, 'Path is not a directory');
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new AppError(404, 'Directory not found');
      }
      if (error instanceof AppError) throw error;
      throw new AppError(500, 'Failed to access directory');
    }

    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    const files: FileInfo[] = [];

    for (const entry of entries) {
      try {
        const entryPath = path.join(fullPath, entry.name);
        const stat = await fs.stat(entryPath);
        const relativePath = path.relative(serverBasePath, entryPath).replace(/\\/g, '/');

        files.push({
          name: entry.name,
          path: relativePath,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: stat.size,
          modified: stat.mtime.toISOString(),
          extension: entry.isFile() ? this.getExtension(entry.name) : undefined,
        });
      } catch (error) {
        // Skip files we can't stat (permissions, etc.)
        logger.debug('Skipping inaccessible file', { name: entry.name, error });
      }
    }

    // Sort: directories first, then alphabetically
    files.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    return files;
  }

  async readFile(serverId: string, filePath: string): Promise<FileContent> {
    const serverBasePath = await this.getServerBasePath(serverId);
    const fullPath = this.validateAndResolvePath(serverBasePath, filePath);

    // Check if file exists and is not a directory
    let stat;
    try {
      stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        throw new AppError(400, 'Cannot read a directory');
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new AppError(404, 'File not found');
      }
      if (error instanceof AppError) throw error;
      throw new AppError(500, 'Failed to access file');
    }

    // Check if it's a binary file
    if (this.isBinaryFile(filePath)) {
      throw new AppError(400, 'Cannot edit binary files. Use download instead.');
    }

    // Limit file size for reading (10MB max)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (stat.size > MAX_FILE_SIZE) {
      throw new AppError(400, 'File is too large to edit (max 10MB)');
    }

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      return {
        path: filePath,
        content,
        size: stat.size,
        modified: stat.mtime.toISOString(),
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new AppError(404, 'File not found');
      }
      logger.error('Failed to read file', { filePath, error });
      throw new AppError(500, 'Failed to read file');
    }
  }

  async writeFile(serverId: string, filePath: string, content: string): Promise<void> {
    const serverBasePath = await this.getServerBasePath(serverId);
    const fullPath = this.validateAndResolvePath(serverBasePath, filePath);

    // Check if it's a binary file
    if (this.isBinaryFile(filePath)) {
      throw new AppError(400, 'Cannot edit binary files');
    }

    // Check if file exists (we only allow editing existing files, not creating via write)
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        throw new AppError(400, 'Cannot write to a directory');
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new AppError(404, 'File not found. Use create to make a new file.');
      }
      if (error instanceof AppError) throw error;
      throw new AppError(500, 'Failed to access file');
    }

    try {
      await fs.writeFile(fullPath, content, 'utf-8');
      logger.info('File written', { serverId, filePath });
    } catch (error: any) {
      logger.error('Failed to write file', { filePath, error });
      throw new AppError(500, 'Failed to write file');
    }
  }

  async createFile(serverId: string, filePath: string, type: 'file' | 'directory'): Promise<FileInfo> {
    const serverBasePath = await this.getServerBasePath(serverId);
    const fullPath = this.validateAndResolvePath(serverBasePath, filePath);

    // Check if already exists
    try {
      await fs.access(fullPath);
      throw new AppError(409, `${type === 'directory' ? 'Directory' : 'File'} already exists`);
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      // ENOENT is expected - file doesn't exist yet
      if (error.code !== 'ENOENT') {
        throw new AppError(500, 'Failed to check path');
      }
    }

    // Ensure parent directory exists
    const parentDir = path.dirname(fullPath);
    try {
      await fs.mkdir(parentDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create parent directory', { parentDir, error });
      throw new AppError(500, 'Failed to create parent directory');
    }

    try {
      if (type === 'directory') {
        await fs.mkdir(fullPath);
      } else {
        await fs.writeFile(fullPath, '', 'utf-8');
      }

      const stat = await fs.stat(fullPath);
      const relativePath = path.relative(serverBasePath, fullPath).replace(/\\/g, '/');

      logger.info('Created', { serverId, filePath, type });

      return {
        name: path.basename(fullPath),
        path: relativePath,
        type,
        size: stat.size,
        modified: stat.mtime.toISOString(),
        extension: type === 'file' ? this.getExtension(filePath) : undefined,
      };
    } catch (error: any) {
      logger.error('Failed to create', { filePath, type, error });
      throw new AppError(500, `Failed to create ${type}`);
    }
  }

  async deleteFile(serverId: string, filePath: string): Promise<void> {
    const serverBasePath = await this.getServerBasePath(serverId);
    const fullPath = this.validateAndResolvePath(serverBasePath, filePath);

    // Prevent deleting the server root
    if (fullPath === serverBasePath || fullPath === path.resolve(serverBasePath)) {
      throw new AppError(403, 'Cannot delete server root directory');
    }

    // Check if exists
    let stat;
    try {
      stat = await fs.stat(fullPath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new AppError(404, 'File or directory not found');
      }
      throw new AppError(500, 'Failed to access path');
    }

    try {
      if (stat.isDirectory()) {
        await fs.rm(fullPath, { recursive: true, force: true });
      } else {
        await fs.unlink(fullPath);
      }
      logger.info('Deleted', { serverId, filePath, type: stat.isDirectory() ? 'directory' : 'file' });
    } catch (error: any) {
      logger.error('Failed to delete', { filePath, error });
      throw new AppError(500, 'Failed to delete');
    }
  }

  async renameFile(serverId: string, oldPath: string, newName: string): Promise<FileInfo> {
    const serverBasePath = await this.getServerBasePath(serverId);
    const fullOldPath = this.validateAndResolvePath(serverBasePath, oldPath);

    // Prevent renaming the server root
    if (fullOldPath === serverBasePath || fullOldPath === path.resolve(serverBasePath)) {
      throw new AppError(403, 'Cannot rename server root directory');
    }

    // Check if source exists
    let stat;
    try {
      stat = await fs.stat(fullOldPath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new AppError(404, 'File or directory not found');
      }
      throw new AppError(500, 'Failed to access path');
    }

    // Build new path (same directory, new name)
    const parentDir = path.dirname(fullOldPath);
    const fullNewPath = path.join(parentDir, newName);

    // Validate new path stays within bounds
    this.validateAndResolvePath(serverBasePath, path.relative(serverBasePath, fullNewPath));

    // Check if destination already exists
    try {
      await fs.access(fullNewPath);
      throw new AppError(409, 'A file or directory with that name already exists');
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      // ENOENT is expected
    }

    try {
      await fs.rename(fullOldPath, fullNewPath);

      const newStat = await fs.stat(fullNewPath);
      const relativePath = path.relative(serverBasePath, fullNewPath).replace(/\\/g, '/');

      logger.info('Renamed', { serverId, oldPath, newName });

      return {
        name: newName,
        path: relativePath,
        type: stat.isDirectory() ? 'directory' : 'file',
        size: newStat.size,
        modified: newStat.mtime.toISOString(),
        extension: stat.isFile() ? this.getExtension(newName) : undefined,
      };
    } catch (error: any) {
      logger.error('Failed to rename', { oldPath, newName, error });
      throw new AppError(500, 'Failed to rename');
    }
  }

  async getDownloadPath(serverId: string, filePath: string): Promise<{ fullPath: string; filename: string; size: number }> {
    const serverBasePath = await this.getServerBasePath(serverId);
    const fullPath = this.validateAndResolvePath(serverBasePath, filePath);

    let stat;
    try {
      stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        throw new AppError(400, 'Cannot download a directory');
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new AppError(404, 'File not found');
      }
      if (error instanceof AppError) throw error;
      throw new AppError(500, 'Failed to access file');
    }

    return {
      fullPath,
      filename: path.basename(fullPath),
      size: stat.size,
    };
  }

  async handleUpload(
    serverId: string,
    targetPath: string,
    filename: string,
    fileBuffer: Buffer
  ): Promise<FileInfo> {
    const serverBasePath = await this.getServerBasePath(serverId);

    // Build full target path
    const normalizedTarget = targetPath.replace(/\\/g, '/').replace(/^\/+/, '');
    const fullTargetDir = normalizedTarget
      ? this.validateAndResolvePath(serverBasePath, normalizedTarget)
      : serverBasePath;

    const fullFilePath = path.join(fullTargetDir, filename);

    // Validate full file path
    this.validateAndResolvePath(serverBasePath, path.relative(serverBasePath, fullFilePath));

    // Ensure target directory exists
    try {
      await fs.mkdir(fullTargetDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create upload directory', { fullTargetDir, error });
      throw new AppError(500, 'Failed to create upload directory');
    }

    // Check if file already exists
    try {
      await fs.access(fullFilePath);
      throw new AppError(409, 'A file with that name already exists');
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      // ENOENT is expected
    }

    try {
      await fs.writeFile(fullFilePath, fileBuffer);

      const stat = await fs.stat(fullFilePath);
      const relativePath = path.relative(serverBasePath, fullFilePath).replace(/\\/g, '/');

      logger.info('File uploaded', { serverId, filename, size: stat.size });

      return {
        name: filename,
        path: relativePath,
        type: 'file',
        size: stat.size,
        modified: stat.mtime.toISOString(),
        extension: this.getExtension(filename),
      };
    } catch (error: any) {
      logger.error('Failed to save uploaded file', { filename, error });
      throw new AppError(500, 'Failed to save file');
    }
  }

  createReadStream(fullPath: string) {
    return createReadStream(fullPath);
  }
}
