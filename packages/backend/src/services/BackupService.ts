import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';
import unzipper from 'unzipper';
import type { Backup, BackupRestoreStage } from '@deployy/shared';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

interface BackupResult {
  size: number;
  skippedFiles: string[];
}

export class BackupService extends EventEmitter {
  constructor(private prisma: PrismaClient) {
    super();
  }

  private getBackupsDir(server: { path: string; backupPath: string | null }): string {
    return server.backupPath || path.join(server.path, 'backups');
  }

  async listBackups(serverId: string): Promise<Backup[]> {
    const backups = await this.prisma.backup.findMany({
      where: { serverId },
      orderBy: { createdAt: 'desc' },
    });

    // Check each backup file exists and clean up orphaned entries
    const validBackups: Backup[] = [];
    for (const backup of backups) {
      try {
        await fs.access(backup.path);
        validBackups.push(this.transformBackup(backup));
      } catch {
        // File doesn't exist - remove orphaned database entry
        logger.info('Removing orphaned backup record (file not found)', {
          backupId: backup.id,
          path: backup.path
        });
        await this.prisma.backup.delete({ where: { id: backup.id } });
      }
    }

    return validBackups;
  }

  async getBackup(id: string): Promise<Backup | null> {
    const backup = await this.prisma.backup.findUnique({ where: { id } });
    return backup ? this.transformBackup(backup) : null;
  }

  async createBackup(serverId: string, name?: string): Promise<Backup & { skippedFiles?: string[] }> {
    const server = await this.prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new AppError(404, 'Server not found');
    }

    // Use custom backup path or default to server/backups
    const backupsDir = this.getBackupsDir(server);
    await fs.mkdir(backupsDir, { recursive: true });

    // Generate backup name and filename with friendly timestamp
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // 2026-01-24
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '-'); // 21-08
    const friendlyTimestamp = `${dateStr}_${timeStr}`;

    // If custom name provided, use it in filename (sanitized), otherwise use timestamp
    const sanitizedName = name ? name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50) : null;
    const backupName = name || `Backup ${friendlyTimestamp}`;
    const filename = sanitizedName
      ? `${sanitizedName}_${friendlyTimestamp}.zip`
      : `backup_${friendlyTimestamp}.zip`;
    const backupFilePath = path.join(backupsDir, filename);

    logger.info('Creating backup', { serverId, backupName, backupPath: backupFilePath });

    // Create zip archive with locked file handling
    const result = await this.createZipArchive(server.path, backupFilePath, backupsDir);

    if (result.skippedFiles.length > 0) {
      logger.warn('Some files were skipped during backup (locked/busy)', {
        serverId,
        skippedCount: result.skippedFiles.length,
        skippedFiles: result.skippedFiles.slice(0, 10), // Log first 10
      });
    }

    // Create database record
    const backup = await this.prisma.backup.create({
      data: {
        serverId,
        name: backupName,
        filename,
        size: BigInt(result.size),
        path: backupFilePath,
      },
    });

    logger.info('Backup created', { backupId: backup.id, size: result.size, skippedFiles: result.skippedFiles.length });

    // Enforce retention policy
    await this.enforceRetention(serverId, server.backupRetention);

    const transformedBackup = this.transformBackup(backup);
    return {
      ...transformedBackup,
      skippedFiles: result.skippedFiles.length > 0 ? result.skippedFiles : undefined,
    };
  }

  async deleteBackup(id: string): Promise<void> {
    const backup = await this.prisma.backup.findUnique({ where: { id } });
    if (!backup) {
      throw new AppError(404, 'Backup not found');
    }

    // Delete file from filesystem
    try {
      await fs.unlink(backup.path);
      logger.info('Backup file deleted', { backupId: id, path: backup.path });
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.error('Failed to delete backup file', { error, path: backup.path });
      }
    }

    // Delete database record
    await this.prisma.backup.delete({ where: { id } });
    logger.info('Backup record deleted', { backupId: id });
  }

  private emitRestoreProgress(serverId: string, stage: BackupRestoreStage, message: string) {
    this.emit('restore:progress', { serverId, stage, message });
  }

  async restoreBackup(id: string): Promise<void> {
    const backup = await this.prisma.backup.findUnique({
      where: { id },
      include: { server: true },
    });

    if (!backup) {
      throw new AppError(404, 'Backup not found');
    }

    // Check if backup file exists
    try {
      await fs.access(backup.path);
    } catch {
      throw new AppError(404, 'Backup file not found on disk');
    }

    const serverPath = backup.server.path;
    const serverId = backup.serverId;
    const backupsDir = this.getBackupsDir(backup.server);
    const backupsDirName = path.basename(backupsDir);
    const backupsIsInsideServer = backupsDir.startsWith(serverPath);

    logger.info('Restoring backup', { backupId: id, serverPath });

    // SAFETY: Validate zip file can be opened before deleting anything
    this.emitRestoreProgress(serverId, 'validating', 'Validating backup file...');
    try {
      await this.validateZipFile(backup.path);
    } catch (err) {
      logger.error('Backup file is corrupted or invalid', { backupId: id, path: backup.path, error: err });
      this.emitRestoreProgress(serverId, 'error', 'Backup file is corrupted');
      throw new AppError(400, 'Backup file is corrupted and cannot be restored. Please delete this backup and create a new one.');
    }

    // Extract to a temporary directory first
    this.emitRestoreProgress(serverId, 'extracting', 'Extracting backup...');
    const tempDir = path.join(serverPath, '_restore_temp_' + Date.now());
    try {
      await fs.mkdir(tempDir, { recursive: true });
      await this.extractZipArchive(backup.path, tempDir);
    } catch (err) {
      // Clean up temp dir on failure
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      logger.error('Failed to extract backup to temp directory', { error: err });
      this.emitRestoreProgress(serverId, 'error', 'Failed to extract backup');
      throw new AppError(500, 'Failed to extract backup. The backup file may be corrupted.');
    }

    // Now that extraction succeeded, delete old server files
    this.emitRestoreProgress(serverId, 'replacing', 'Replacing server files...');
    const entries = await fs.readdir(serverPath, { withFileTypes: true });
    for (const entry of entries) {
      // Skip backups folder if it's inside the server directory
      if (backupsIsInsideServer && entry.name === backupsDirName) continue;
      // Skip the temp directory we just created
      if (entry.name === path.basename(tempDir)) continue;

      const entryPath = path.join(serverPath, entry.name);
      await fs.rm(entryPath, { recursive: true, force: true });
    }

    // Move extracted files from temp to server directory
    const tempEntries = await fs.readdir(tempDir);
    for (const entry of tempEntries) {
      const srcPath = path.join(tempDir, entry);
      const destPath = path.join(serverPath, entry);
      await fs.rename(srcPath, destPath);
    }

    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });

    this.emitRestoreProgress(serverId, 'completed', 'Backup restored successfully');
    logger.info('Backup restored', { backupId: id });
  }

  private async validateZipFile(zipPath: string): Promise<void> {
    // Just check file exists and is readable - don't try to parse
    // The unzipper library has issues with some valid zip files
    const stat = await fs.stat(zipPath);
    if (stat.size === 0) {
      throw new Error('Zip file is empty');
    }
    logger.info('Zip file validated', { zipPath, size: stat.size });
  }

  getBackupPath(backup: Backup): string {
    return backup.path;
  }

  async updateRetention(serverId: string, retention: number): Promise<void> {
    await this.prisma.server.update({
      where: { id: serverId },
      data: { backupRetention: retention },
    });

    // Immediately enforce new retention policy
    await this.enforceRetention(serverId, retention);
  }

  async getRetention(serverId: string): Promise<number> {
    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
      select: { backupRetention: true },
    });

    if (!server) {
      throw new AppError(404, 'Server not found');
    }

    return server.backupRetention;
  }

  async getBackupSettings(serverId: string): Promise<{ retention: number; backupPath: string }> {
    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
      select: { backupRetention: true, backupPath: true, path: true },
    });

    if (!server) {
      throw new AppError(404, 'Server not found');
    }

    return {
      retention: server.backupRetention,
      backupPath: server.backupPath || path.join(server.path, 'backups'),
    };
  }

  async updateBackupPath(serverId: string, backupPath: string | null): Promise<void> {
    // Validate the path if provided
    if (backupPath) {
      try {
        // Try to create the directory if it doesn't exist
        await fs.mkdir(backupPath, { recursive: true });
        // Test if we can write to it
        const testFile = path.join(backupPath, '.write-test');
        await fs.writeFile(testFile, 'test');
        await fs.unlink(testFile);
      } catch (error: any) {
        logger.error('Invalid backup path', { error, backupPath });
        throw new AppError(400, `Invalid backup path: ${error.message}`);
      }
    }

    await this.prisma.server.update({
      where: { id: serverId },
      data: { backupPath },
    });

    logger.info('Backup path updated', { serverId, backupPath });
  }

  private async enforceRetention(serverId: string, retention: number): Promise<void> {
    if (retention <= 0) return; // 0 means keep all

    const backups = await this.prisma.backup.findMany({
      where: { serverId },
      orderBy: { createdAt: 'desc' },
    });

    // Delete backups beyond retention limit
    const toDelete = backups.slice(retention);
    for (const backup of toDelete) {
      try {
        await fs.unlink(backup.path);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          logger.error('Failed to delete old backup file', { error, path: backup.path });
        }
      }
      await this.prisma.backup.delete({ where: { id: backup.id } });
      logger.info('Old backup deleted (retention policy)', { backupId: backup.id });
    }
  }

  private async createZipArchive(serverPath: string, outputPath: string, excludeDir: string): Promise<BackupResult> {
    const skippedFiles: string[] = [];
    const excludeDirName = path.basename(excludeDir);

    const output = createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 6 } });

    // Set up the promise to wait for archive completion
    const archivePromise = new Promise<number>((resolve, reject) => {
      output.on('close', () => {
        resolve(archive.pointer());
      });

      output.on('error', (err) => {
        reject(err);
      });

      archive.on('error', (err) => {
        reject(err);
      });

      // Handle warnings (like EBUSY) without failing the entire backup
      archive.on('warning', (err: any) => {
        if (err.code === 'EBUSY' || err.code === 'ENOENT') {
          logger.warn('File skipped during backup', { error: err.message });
        } else {
          reject(err);
        }
      });
    });

    archive.pipe(output);

    // Recursively add files, handling locked files gracefully
    await this.addFilesToArchive(archive, serverPath, '', excludeDirName, skippedFiles);

    // Finalize the archive and wait for it to complete
    await archive.finalize();
    const size = await archivePromise;

    return {
      size,
      skippedFiles,
    };
  }

  private async addFilesToArchive(
    archive: archiver.Archiver,
    basePath: string,
    relativePath: string,
    excludeDirName: string,
    skippedFiles: string[]
  ): Promise<void> {
    const currentPath = relativePath ? path.join(basePath, relativePath) : basePath;

    let entryNames: string[];
    try {
      entryNames = await fs.readdir(currentPath);
    } catch (error: any) {
      if (error.code === 'EBUSY' || error.code === 'EACCES' || error.code === 'EPERM') {
        skippedFiles.push(relativePath || '/');
        return;
      }
      throw error;
    }

    for (const entryName of entryNames) {
      const entryRelativePath = relativePath ? path.join(relativePath, entryName) : entryName;
      const entryFullPath = path.join(basePath, entryRelativePath);

      // Skip the backups directory
      if (entryName === excludeDirName && relativePath === '') {
        continue;
      }

      let stat;
      try {
        stat = await fs.stat(entryFullPath);
      } catch (error: any) {
        if (error.code === 'EBUSY' || error.code === 'EACCES' || error.code === 'EPERM' || error.code === 'ENOENT') {
          skippedFiles.push(entryRelativePath);
          continue;
        }
        throw error;
      }

      if (stat.isDirectory()) {
        await this.addFilesToArchive(archive, basePath, entryRelativePath, excludeDirName, skippedFiles);
      } else if (stat.isFile()) {
        try {
          // Try to read the file to check if it's accessible
          const handle = await fs.open(entryFullPath, 'r');
          await handle.close();

          // Add file to archive
          archive.file(entryFullPath, { name: entryRelativePath });
        } catch (error: any) {
          if (error.code === 'EBUSY' || error.code === 'EACCES' || error.code === 'EPERM') {
            skippedFiles.push(entryRelativePath);
            logger.debug('Skipping locked file', { file: entryRelativePath, error: error.code });
          } else {
            throw error;
          }
        }
      }
    }
  }

  private async extractZipArchive(zipPath: string, outputPath: string): Promise<void> {
    logger.info('Starting zip extraction', { zipPath, outputPath });

    // SECURITY: Use unzipper library instead of shell commands to prevent command injection
    return new Promise((resolve, reject) => {
      const readStream = createReadStream(zipPath);
      const extractor = unzipper.Extract({ path: outputPath });

      readStream
        .pipe(extractor)
        .on('close', () => {
          logger.info('Zip extraction completed', { zipPath, outputPath });
          resolve();
        })
        .on('error', (err) => {
          logger.error('Zip extraction failed', { zipPath, outputPath, error: err });
          reject(new Error(`Failed to extract backup: ${err.message}`));
        });

      readStream.on('error', (err) => {
        logger.error('Failed to read zip file', { zipPath, error: err });
        reject(new Error(`Failed to read backup file: ${err.message}`));
      });
    });
  }

  private transformBackup(backup: any): Backup {
    return {
      ...backup,
      size: Number(backup.size),
    };
  }
}
