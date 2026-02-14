import { EventEmitter } from 'node:events';
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import { pipeline } from 'node:stream/promises';
import archiver from 'archiver';
import unzipper from 'unzipper';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { logger } from '../utils/logger.js';

// Only used for trusted commands (pnpm install), not user input
const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
import type {
  UpdateStatus,
  UpdateInfo,
  PanelSettings,
  EnvMergeResult,
  UpdateBackupInfo,
  UpdateProgress,
} from '@deployy/shared';

const GITHUB_API_URL = 'https://api.github.com/repos/MillerSpil/Deployy-Panel/releases/latest';
const DEFAULT_SETTINGS: PanelSettings = { autoCheckUpdates: true, telemetryEnabled: true };
const UPDATE_TEST_MODE = process.env.UPDATE_TEST_MODE === 'true';

// Files and directories to preserve during updates (never overwrite)
const PRESERVE_PATTERNS = [
  '*.db',
  '.env',
  'backups',
  'update-backups',
  'node_modules',
  '.git',
  'servers',
];

export class UpdateService extends EventEmitter {
  private updateInProgress = false;
  private panelRootPath: string;
  private updateBackupsPath: string;

  constructor(private prisma: PrismaClient) {
    super();
    // Panel root is 4 levels up from this file (services -> src -> backend -> packages -> root)
    this.panelRootPath = path.resolve(__dirname, '..', '..', '..', '..');
    this.updateBackupsPath = path.join(this.panelRootPath, 'update-backups');
    logger.info('UpdateService initialized', { panelRootPath: this.panelRootPath });
  }

  private emitProgress(status: UpdateStatus, message: string, progress?: number, envChanges?: EnvMergeResult): void {
    const data: UpdateProgress = { status, message, progress, envChanges };
    logger.info('Update progress', { status, message, progress });
    this.emit('progress', data);
  }

  async getSettings(): Promise<PanelSettings> {
    const record = await this.prisma.panelSettings.findUnique({
      where: { id: 'default' },
    });

    if (!record) {
      return DEFAULT_SETTINGS;
    }

    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(record.settings) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  async updateSettings(settings: Partial<PanelSettings>): Promise<PanelSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };

    await this.prisma.panelSettings.upsert({
      where: { id: 'default' },
      update: { settings: JSON.stringify(updated) },
      create: { id: 'default', settings: JSON.stringify(updated) },
    });

    return updated;
  }

  async checkForUpdates(): Promise<UpdateInfo> {
    this.emitProgress('checking', 'Checking for updates...');

    // Get current version from package.json
    const currentVersion = this.getCurrentVersion();

    // Test mode: return fake update data
    if (UPDATE_TEST_MODE) {
      logger.info('Update test mode enabled, returning fake update data');
      const fakeUpdateInfo: UpdateInfo = {
        currentVersion,
        latestVersion: '0.2.0',
        updateAvailable: true,
        releaseUrl: 'https://github.com/MillerSpil/Deployy-Panel/releases/tag/v0.2.0',
        releaseNotes: `## What's New in v0.2.0

### Features
- Added panel self-update system
- New backup and rollback functionality
- Improved server management UI

### Bug Fixes
- Fixed memory leak in WebSocket connections
- Resolved scheduled task timing issues

### Notes
This is **test mode** data. Set UPDATE_TEST_MODE=false to check real GitHub releases.`,
        publishedAt: new Date().toISOString(),
        downloadUrl: 'https://github.com/MillerSpil/Deployy-Panel/archive/refs/tags/v0.2.0.zip',
      };
      this.emitProgress('idle', 'Update available! (test mode)');
      return fakeUpdateInfo;
    }

    try {
      // Fetch latest release from GitHub
      const release = await this.fetchGitHubRelease();

      // Compare versions (strip 'v' prefix if present)
      const latestVersion = release.tag_name.replace(/^v/, '');
      const updateAvailable = this.isNewerVersion(latestVersion, currentVersion);

      const updateInfo: UpdateInfo = {
        currentVersion,
        latestVersion,
        updateAvailable,
        releaseUrl: release.html_url,
        releaseNotes: release.body || 'No release notes available.',
        publishedAt: release.published_at,
        downloadUrl: release.zipball_url,
      };

      this.emitProgress('idle', updateAvailable ? 'Update available!' : 'Panel is up to date');
      return updateInfo;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.warn('Failed to check for updates', { error: message });

      // Return current version info even if GitHub check fails
      const updateInfo: UpdateInfo = {
        currentVersion,
        latestVersion: currentVersion,
        updateAvailable: false,
        releaseUrl: '',
        releaseNotes: `Could not check for updates: ${message}`,
        publishedAt: '',
        downloadUrl: '',
      };

      this.emitProgress('idle', `Could not check for updates: ${message}`);
      return updateInfo;
    }
  }

  private async fetchGitHubRelease(): Promise<any> {
    return new Promise((resolve, reject) => {
      const options = {
        headers: {
          'User-Agent': 'Deployy-Panel',
          Accept: 'application/vnd.github.v3+json',
        },
      };

      https
        .get(GITHUB_API_URL, options, (response) => {
          if (response.statusCode === 302 || response.statusCode === 301) {
            // Follow redirect
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              https.get(redirectUrl, options, (redirectResponse) => {
                this.handleGitHubResponse(redirectResponse, resolve, reject);
              });
              return;
            }
          }

          this.handleGitHubResponse(response, resolve, reject);
        })
        .on('error', reject);
    });
  }

  private handleGitHubResponse(
    response: any,
    resolve: (value: any) => void,
    reject: (reason: any) => void
  ): void {
    let data = '';

    response.on('data', (chunk: string) => {
      data += chunk;
    });

    response.on('end', () => {
      if (response.statusCode === 200) {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON response from GitHub'));
        }
      } else if (response.statusCode === 404) {
        reject(new Error('No releases found on GitHub'));
      } else {
        reject(new Error(`GitHub API error: ${response.statusCode}`));
      }
    });

    response.on('error', reject);
  }

  private isNewerVersion(latest: string, current: string): boolean {
    const latestParts = latest.split('.').map(Number);
    const currentParts = current.split('.').map(Number);

    for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
      const latestPart = latestParts[i] || 0;
      const currentPart = currentParts[i] || 0;

      if (latestPart > currentPart) return true;
      if (latestPart < currentPart) return false;
    }

    return false;
  }

  async performUpdate(downloadUrl: string, targetVersion: string): Promise<void> {
    if (this.updateInProgress) {
      throw new Error('Update already in progress');
    }

    this.updateInProgress = true;

    try {
      // Step 1: Create backup
      this.emitProgress('backing_up', 'Creating backup of current installation...');
      const backupId = await this.createBackup();
      logger.info('Backup created', { backupId });

      // Step 2: Download release
      this.emitProgress('downloading', 'Downloading update...', 0);
      const tempDir = path.join(os.tmpdir(), `deployy-update-${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });
      const zipPath = path.join(tempDir, 'release.zip');
      await this.downloadFile(downloadUrl, zipPath);

      // Step 3: Extract release
      this.emitProgress('extracting', 'Extracting update files...');
      const extractDir = path.join(tempDir, 'extracted');
      await fs.mkdir(extractDir, { recursive: true });
      await this.extractZip(zipPath, extractDir);

      // Find the extracted folder (GitHub creates a folder like "MillerSpil-Deployy-Panel-abc123")
      const extractedContents = await fs.readdir(extractDir);
      let releaseFolder: string | undefined;
      for (const name of extractedContents) {
        const stat = await fs.stat(path.join(extractDir, name));
        if (stat.isDirectory()) {
          releaseFolder = name;
          break;
        }
      }

      if (!releaseFolder) {
        throw new Error('Could not find extracted release folder');
      }

      const releasePath = path.join(extractDir, releaseFolder);

      // Step 4: Merge .env files
      this.emitProgress('merging_env', 'Merging environment configuration...');
      const envChanges = await this.mergeEnvFiles(releasePath);

      // Step 5: Replace files
      this.emitProgress('replacing_files', 'Updating panel files...');
      await this.replaceFiles(releasePath);

      // Step 6: Run pnpm install
      this.emitProgress('installing_deps', 'Installing dependencies (this may take a while)...');
      await this.runPnpmInstall();

      // Cleanup temp directory
      await fs.rm(tempDir, { recursive: true, force: true });

      this.emitProgress('completed', `Update to v${targetVersion} completed! Please restart the panel.`, undefined, envChanges);
      logger.info('Update completed successfully', { targetVersion });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Update failed', { error });
      this.emitProgress('error', `Update failed: ${message}. You may need to restore from backup.`);
      throw error;
    } finally {
      this.updateInProgress = false;
    }
  }

  private async createBackup(): Promise<string> {
    // Ensure backup directory exists
    await fs.mkdir(this.updateBackupsPath, { recursive: true });

    // Get current version
    const packageJsonPath = path.join(this.panelRootPath, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    const currentVersion = packageJson.version;

    // Create backup filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `backup-v${currentVersion}-${timestamp}.zip`;
    const backupPath = path.join(this.updateBackupsPath, backupFilename);

    // Create the archive
    const output = createWriteStream(backupPath);
    const archive = archiver('zip', { zlib: { level: 6 } });

    const archivePromise = new Promise<void>((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
      archive.on('warning', (err) => {
        if (err.code !== 'ENOENT' && err.code !== 'EBUSY') {
          reject(err);
        }
      });
    });

    archive.pipe(output);

    // Add files to archive, excluding preserved directories
    await this.addFilesToBackup(archive, this.panelRootPath, '');

    await archive.finalize();
    await archivePromise;

    // Get backup size
    const stats = await fs.stat(backupPath);

    // Save to database
    const backup = await this.prisma.updateBackup.create({
      data: {
        version: currentVersion,
        backupPath,
      },
    });

    logger.info('Backup created', { backupId: backup.id, size: stats.size });
    return backup.id;
  }

  private async addFilesToBackup(archive: archiver.Archiver, basePath: string, relativePath: string): Promise<void> {
    const currentPath = path.join(basePath, relativePath);
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryRelativePath = path.join(relativePath, entry.name);
      const entryFullPath = path.join(basePath, entryRelativePath);

      // Skip preserved patterns
      if (this.shouldPreserve(entry.name, entryRelativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.addFilesToBackup(archive, basePath, entryRelativePath);
      } else {
        try {
          archive.file(entryFullPath, { name: entryRelativePath });
        } catch (err) {
          // Skip files that can't be read
          logger.warn('Skipped file during backup', { path: entryRelativePath, error: err });
        }
      }
    }
  }

  private shouldPreserve(name: string, relativePath: string): boolean {
    for (const pattern of PRESERVE_PATTERNS) {
      if (pattern.startsWith('*.')) {
        // Wildcard extension pattern
        const ext = pattern.slice(1);
        if (name.endsWith(ext)) return true;
      } else {
        // Exact match for directories/files
        if (name === pattern || relativePath.startsWith(pattern + path.sep)) return true;
      }
    }
    return false;
  }

  private async downloadFile(url: string, destPath: string): Promise<void> {
    logger.info('Downloading file', { url, destPath });

    return new Promise((resolve, reject) => {
      const file = createWriteStream(destPath);

      const makeRequest = (requestUrl: string) => {
        const options = {
          headers: {
            'User-Agent': 'Deployy-Panel',
            Accept: 'application/vnd.github+json',
          },
        };

        https
          .get(requestUrl, options, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
              const redirectUrl = response.headers.location;
              if (redirectUrl) {
                makeRequest(redirectUrl);
                return;
              }
            }

            if (response.statusCode !== 200) {
              file.close();
              reject(new Error(`Download failed: HTTP ${response.statusCode}`));
              return;
            }

            const totalSize = parseInt(response.headers['content-length'] || '0', 10);
            let downloadedSize = 0;

            response.on('data', (chunk: Buffer) => {
              downloadedSize += chunk.length;
              if (totalSize > 0) {
                const progress = Math.round((downloadedSize / totalSize) * 100);
                this.emitProgress('downloading', `Downloading update... ${progress}%`, progress);
              }
            });

            response.pipe(file);

            file.on('finish', () => {
              file.close();
              resolve();
            });
          })
          .on('error', (err) => {
            file.close();
            fs.unlink(destPath).catch(() => {});
            reject(err);
          });
      };

      makeRequest(url);
    });
  }

  private async extractZip(zipPath: string, destPath: string): Promise<void> {
    // SECURITY: Use unzipper library instead of shell commands to prevent command injection
    return new Promise((resolve, reject) => {
      const readStream = createReadStream(zipPath);
      const extractor = unzipper.Extract({ path: destPath });

      readStream
        .pipe(extractor)
        .on('close', () => {
          logger.info('Zip extraction completed', { zipPath, destPath });
          resolve();
        })
        .on('error', (err) => {
          logger.error('Zip extraction failed', { zipPath, destPath, error: err });
          reject(err);
        });

      readStream.on('error', (err) => {
        logger.error('Failed to read zip file', { zipPath, error: err });
        reject(err);
      });
    });
  }

  private async mergeEnvFiles(releasePath: string): Promise<EnvMergeResult> {
    const oldEnvPath = path.join(this.panelRootPath, 'packages', 'backend', '.env');
    const newEnvExamplePath = path.join(releasePath, 'packages', 'backend', '.env.example');

    const result: EnvMergeResult = { added: [], preserved: [], removed: [] };

    // Check if old .env exists
    let oldEnv: Record<string, string> = {};
    try {
      const oldEnvContent = await fs.readFile(oldEnvPath, 'utf-8');
      oldEnv = this.parseEnvFile(oldEnvContent);
    } catch {
      // No existing .env file
      logger.info('No existing .env file found');
    }

    // Check if new .env.example exists
    let newExample: Record<string, string> = {};
    try {
      const newExampleContent = await fs.readFile(newEnvExamplePath, 'utf-8');
      newExample = this.parseEnvFile(newExampleContent);
    } catch {
      logger.info('No .env.example in new release');
      return result;
    }

    // Merge: preserve existing values, add new keys from example
    const merged: Record<string, string> = {};

    for (const key of Object.keys(newExample)) {
      if (key in oldEnv) {
        merged[key] = oldEnv[key];
        result.preserved.push(key);
      } else {
        merged[key] = newExample[key];
        result.added.push(key);
      }
    }

    // Track removed keys
    for (const key of Object.keys(oldEnv)) {
      if (!(key in newExample)) {
        result.removed.push(key);
        // Keep removed keys in merged file with a comment
        merged[key] = oldEnv[key];
      }
    }

    // Write merged .env file
    const mergedContent = Object.entries(merged)
      .map(([key, value]) => {
        const isRemoved = result.removed.includes(key);
        const prefix = isRemoved ? '# DEPRECATED: ' : '';
        return `${prefix}${key}=${value}`;
      })
      .join('\n');

    await fs.writeFile(oldEnvPath, mergedContent + '\n', 'utf-8');

    logger.info('Env files merged', { result });
    return result;
  }

  private parseEnvFile(content: string): Record<string, string> {
    const result: Record<string, string> = {};

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();

      // Remove quotes if present
      const unquoted = value.replace(/^["']|["']$/g, '');
      result[key] = unquoted;
    }

    return result;
  }

  private async replaceFiles(releasePath: string): Promise<void> {
    await this.copyDirectory(releasePath, this.panelRootPath);
  }

  private async copyDirectory(src: string, dest: string): Promise<void> {
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      // Skip preserved files/directories
      if (this.shouldPreserve(entry.name, entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        await fs.mkdir(destPath, { recursive: true });
        await this.copyDirectory(srcPath, destPath);
      } else {
        try {
          await fs.copyFile(srcPath, destPath);
        } catch (err) {
          logger.warn('Failed to copy file', { src: srcPath, dest: destPath, error: err });
        }
      }
    }
  }

  private async runPnpmInstall(): Promise<void> {
    const isWindows = os.platform() === 'win32';
    const pnpmCommand = isWindows ? 'pnpm.cmd' : 'pnpm';

    try {
      await execAsync(`${pnpmCommand} install`, {
        cwd: this.panelRootPath,
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large outputs
        timeout: 5 * 60 * 1000, // 5 minute timeout
      });
      logger.info('pnpm install completed');
    } catch (error) {
      logger.error('pnpm install failed', { error });
      throw new Error('Failed to install dependencies. Please run "pnpm install" manually.');
    }

    // Build all packages (shared must build before frontend/backend)
    try {
      this.emitProgress('installing_deps', 'Building panel (this may take a while)...');
      await execAsync(`${pnpmCommand} build`, {
        cwd: this.panelRootPath,
        maxBuffer: 50 * 1024 * 1024,
        timeout: 10 * 60 * 1000, // 10 minute timeout for build
      });
      logger.info('pnpm build completed');
    } catch (error) {
      logger.error('pnpm build failed', { error });
      throw new Error('Failed to build panel. Please run "pnpm build" manually.');
    }
  }

  async listBackups(): Promise<UpdateBackupInfo[]> {
    const backups = await this.prisma.updateBackup.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const result: UpdateBackupInfo[] = [];

    for (const backup of backups) {
      let size = 0;
      try {
        const stats = await fs.stat(backup.backupPath);
        size = Number(stats.size);
      } catch {
        // Backup file might not exist
      }

      result.push({
        id: backup.id,
        version: backup.version,
        backupPath: backup.backupPath,
        size,
        createdAt: backup.createdAt,
      });
    }

    return result;
  }

  async deleteBackup(backupId: string): Promise<void> {
    const backup = await this.prisma.updateBackup.findUnique({
      where: { id: backupId },
    });

    if (!backup) {
      throw new Error('Backup not found');
    }

    // Delete the file
    try {
      await fs.rm(backup.backupPath, { force: true });
    } catch (err) {
      logger.warn('Failed to delete backup file', { path: backup.backupPath, error: err });
    }

    // Delete from database
    await this.prisma.updateBackup.delete({
      where: { id: backupId },
    });

    logger.info('Backup deleted', { backupId });
  }

  async rollback(backupId: string): Promise<void> {
    if (this.updateInProgress) {
      throw new Error('Cannot rollback while update is in progress');
    }

    const backup = await this.prisma.updateBackup.findUnique({
      where: { id: backupId },
    });

    if (!backup) {
      throw new Error('Backup not found');
    }

    // Verify backup file exists
    try {
      await fs.access(backup.backupPath);
    } catch {
      throw new Error('Backup file not found on disk');
    }

    this.updateInProgress = true;

    try {
      this.emitProgress('extracting', 'Restoring from backup...');

      // Extract backup to panel root
      const tempDir = path.join(os.tmpdir(), `deployy-rollback-${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });

      await this.extractZip(backup.backupPath, tempDir);

      // Copy files back
      this.emitProgress('replacing_files', 'Restoring files...');
      await this.copyDirectory(tempDir, this.panelRootPath);

      // Cleanup temp
      await fs.rm(tempDir, { recursive: true, force: true });

      // Run pnpm install
      this.emitProgress('installing_deps', 'Reinstalling dependencies...');
      await this.runPnpmInstall();

      this.emitProgress('completed', `Rolled back to v${backup.version}. Please restart the panel.`);
      logger.info('Rollback completed', { backupId, version: backup.version });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Rollback failed', { error });
      this.emitProgress('error', `Rollback failed: ${message}`);
      throw error;
    } finally {
      this.updateInProgress = false;
    }
  }

  getCurrentVersion(): string {
    try {
      const packageJsonPath = path.join(this.panelRootPath, 'package.json');
      // Synchronously read for simple version check
      const fsSync = require('node:fs') as typeof import('node:fs');
      const packageJson = JSON.parse(fsSync.readFileSync(packageJsonPath, 'utf-8'));
      return packageJson.version || 'unknown';
    } catch (err) {
      logger.error('Failed to read package.json version', {
        panelRootPath: this.panelRootPath,
        error: err instanceof Error ? err.message : err
      });
      return 'unknown';
    }
  }

  isUpdateInProgress(): boolean {
    return this.updateInProgress;
  }
}
