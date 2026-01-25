import { EventEmitter } from 'node:events';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createReadStream } from 'node:fs';
import { Extract } from 'unzip-stream';
import { logger } from '../utils/logger.js';

const DOWNLOADER_URL = 'https://downloader.hytale.com/hytale-downloader.zip';
// Match OAuth URLs from Hytale accounts
const AUTH_URL_REGEX = /https:\/\/oauth\.accounts\.hytale\.com\/[^\s]+/;

export type DownloadStatus =
  | 'downloading_tool'
  | 'extracting_tool'
  | 'waiting_auth'
  | 'downloading_server'
  | 'extracting_server'
  | 'cleanup'
  | 'completed'
  | 'error';

export interface DownloadProgress {
  status: DownloadStatus;
  message: string;
  authUrl?: string;
}

export class HytaleDownloadService extends EventEmitter {
  private process: ChildProcess | null = null;
  private aborted = false;

  constructor(private serverPath: string) {
    super();
  }

  async download(): Promise<void> {
    const tempDir = path.join(os.tmpdir(), `hytale-download-${Date.now()}`);
    logger.info('Starting Hytale download', { tempDir, serverPath: this.serverPath });

    try {
      logger.info('Creating directories', { tempDir, serverPath: this.serverPath });
      await fs.mkdir(tempDir, { recursive: true });
      await fs.mkdir(this.serverPath, { recursive: true });

      // Step 1: Download the tool
      logger.info('Step 1: Downloading hytale-downloader.zip');
      this.emitProgress('downloading_tool', 'Downloading Hytale downloader tool...');
      const zipPath = path.join(tempDir, 'hytale-downloader.zip');
      await this.downloadFile(DOWNLOADER_URL, zipPath);
      logger.info('Download complete', { zipPath });

      if (this.aborted) return;

      // Step 2: Extract the tool
      logger.info('Step 2: Extracting downloader tool');
      this.emitProgress('extracting_tool', 'Extracting downloader tool...');
      await this.extractZip(zipPath, tempDir);

      // List extracted files
      const extractedFiles = await fs.readdir(tempDir);
      logger.info('Extracted files', { files: extractedFiles });

      if (this.aborted) return;

      // Step 3: Run the downloader
      const executable = this.getExecutablePath(tempDir);
      logger.info('Step 3: Running downloader', { executable });

      // Check if executable exists
      try {
        await fs.access(executable);
        logger.info('Executable found');
      } catch {
        logger.error('Executable not found!', { executable, availableFiles: extractedFiles });
        throw new Error(`Executable not found: ${executable}`);
      }

      this.emitProgress('waiting_auth', 'Starting downloader... Waiting for authentication.');
      await this.runDownloader(executable, tempDir);
      logger.info('Downloader finished');

      if (this.aborted) return;

      // Step 4: Find and extract the server files
      logger.info('Step 4: Extracting server files');
      this.emitProgress('extracting_server', 'Extracting server files...');
      await this.extractServerFiles(tempDir);

      // Step 5: Cleanup
      logger.info('Step 5: Cleanup');
      this.emitProgress('cleanup', 'Cleaning up temporary files...');
      await this.cleanup(tempDir);

      logger.info('Hytale download completed successfully');
      this.emitProgress('completed', 'Server files downloaded successfully!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Hytale download failed', { error, message, serverPath: this.serverPath });
      this.emitProgress('error', `Download failed: ${message}`);

      // Cleanup on error
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }

      throw error;
    }
  }

  abort(): void {
    this.aborted = true;
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  private emitProgress(status: DownloadStatus, message: string, authUrl?: string): void {
    const progress: DownloadProgress = { status, message, authUrl };
    logger.info('Emitting progress event', { status, message, hasAuthUrl: !!authUrl });
    this.emit('progress', progress);
  }

  private emitLog(line: string): void {
    this.emit('log', line);
  }

  private async downloadFile(url: string, destPath: string): Promise<void> {
    logger.info('Downloading file', { url, destPath });
    return new Promise((resolve, reject) => {
      const file = createWriteStream(destPath);

      const request = https.get(url, (response) => {
        logger.info('Got response', { statusCode: response.statusCode, headers: response.headers.location ? 'has redirect' : 'no redirect' });

        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirect
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            logger.info('Following redirect', { redirectUrl });
            file.close();
            this.downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          file.close();
          const error = new Error(`Failed to download: HTTP ${response.statusCode}`);
          logger.error('Download failed', { statusCode: response.statusCode });
          reject(error);
          return;
        }

        let downloadedBytes = 0;
        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          logger.info('File download complete', { destPath, bytes: downloadedBytes });
          resolve();
        });

        file.on('error', (err) => {
          file.close();
          logger.error('File write error', { error: err });
          fs.unlink(destPath).catch(() => {});
          reject(err);
        });
      });

      request.on('error', (err) => {
        file.close();
        logger.error('Request error', { error: err });
        fs.unlink(destPath).catch(() => {});
        reject(err);
      });

      request.setTimeout(30000, () => {
        request.destroy();
        file.close();
        logger.error('Request timeout');
        reject(new Error('Download timeout'));
      });
    });
  }

  private async extractZip(zipPath: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const readStream = createReadStream(zipPath);
      const extractor = Extract({ path: destPath });

      readStream
        .pipe(extractor)
        .on('close', resolve)
        .on('error', reject);
    });
  }

  private getExecutablePath(tempDir: string): string {
    const isWindows = os.platform() === 'win32';
    const exeName = isWindows
      ? 'hytale-downloader-windows-amd64.exe'
      : 'hytale-downloader-linux-amd64';
    return path.join(tempDir, exeName);
  }

  private async runDownloader(executable: string, workDir: string): Promise<void> {
    const isWindows = os.platform() === 'win32';
    logger.info('Running downloader', { executable, workDir, isWindows });

    // Make executable on Linux
    if (!isWindows) {
      await fs.chmod(executable, 0o755);
      logger.info('Set executable permissions');
    }

    return new Promise((resolve, reject) => {
      logger.info('Spawning process');
      this.process = spawn(executable, [], {
        cwd: workDir,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      logger.info('Process spawned', { pid: this.process.pid });

      let authUrlDetected = false;
      let serverDownloadStarted = false;
      let downloadedZipPath: string | null = null;

      const handleOutput = (data: Buffer) => {
        const lines = data.toString().split('\n').filter(l => l.trim());

        for (const line of lines) {
          logger.info('Downloader output', { line });
          this.emitLog(line);

          // Detect OAuth URL
          const authMatch = line.match(AUTH_URL_REGEX);
          if (authMatch && !authUrlDetected) {
            authUrlDetected = true;
            logger.info('OAuth URL detected', { url: authMatch[0] });
            this.emitProgress('waiting_auth', 'Please authenticate in your browser', authMatch[0]);
          }

          // Detect download progress
          if (line.includes('Downloading') && !serverDownloadStarted) {
            serverDownloadStarted = true;
            logger.info('Server download started');
            this.emitProgress('downloading_server', 'Downloading server files...');
          }

          // Detect completion - look for the downloaded zip file name
          const zipMatch = line.match(/(\d{4}\.\d{2}\.\d{2}-[a-zA-Z0-9]+\.zip)/);
          if (zipMatch) {
            downloadedZipPath = path.join(workDir, zipMatch[1]);
            logger.info('Detected server zip', { downloadedZipPath });
          }
        }
      };

      this.process.stdout?.on('data', handleOutput);
      this.process.stderr?.on('data', handleOutput);

      this.process.on('close', (code) => {
        logger.info('Process closed', { code });
        this.process = null;

        if (this.aborted) {
          reject(new Error('Download aborted'));
          return;
        }

        if (code === 0) {
          // Store the downloaded zip path for extraction
          (this as any)._downloadedZipPath = downloadedZipPath;
          resolve();
        } else {
          reject(new Error(`Downloader exited with code ${code}`));
        }
      });

      this.process.on('error', (err) => {
        logger.error('Process error', { error: err });
        this.process = null;
        reject(err);
      });
    });
  }

  private async extractServerFiles(tempDir: string): Promise<void> {
    // Find the downloaded zip file
    const files = await fs.readdir(tempDir);
    const serverZip = files.find(f => f.match(/^\d{4}\.\d{2}\.\d{2}-[a-zA-Z0-9]+\.zip$/));

    if (!serverZip) {
      throw new Error('Could not find downloaded server files');
    }

    const zipPath = path.join(tempDir, serverZip);

    // Extract to server path
    await this.extractZip(zipPath, this.serverPath);
    this.emitLog(`Extracted server files to ${this.serverPath}`);
  }

  private async cleanup(tempDir: string): Promise<void> {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      this.emitLog('Cleaned up temporary files');
    } catch (error) {
      logger.warn('Failed to cleanup temp directory', { tempDir, error });
    }
  }
}
