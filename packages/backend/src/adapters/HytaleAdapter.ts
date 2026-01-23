import { BaseAdapter } from './BaseAdapter.js';
import { spawn, execSync } from 'node:child_process';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { InstallConfig, InstallResult, GameConfig } from '@deployy/shared';
import { logger } from '../utils/logger.js';

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/\[[\d;]*m/g, '');
}

function findJavaPath(): string {
  const isWindows = os.platform() === 'win32';
  const javaCmd = isWindows ? 'java.exe' : 'java';

  try {
    const whereCmd = isWindows ? 'where java' : 'which java';
    const result = execSync(whereCmd, { encoding: 'utf-8', timeout: 5000 }).trim();
    if (result) {
      const firstPath = result.split('\n')[0].trim();
      logger.info(`Found Java at: ${firstPath}`);
      return firstPath;
    }
  } catch {
    logger.warn('Java not found in PATH, checking common locations...');
  }

  if (isWindows) {
    const commonPaths = [
      'C:\\Program Files\\Java\\jdk-25.0.2\\bin\\java.exe',
      'C:\\Program Files\\Java\\jdk-21\\bin\\java.exe',
      'C:\\Program Files\\Java\\jdk-17\\bin\\java.exe',
      'C:\\Program Files\\Eclipse Adoptium\\jdk-21\\bin\\java.exe',
      'C:\\Program Files\\Microsoft\\jdk-17\\bin\\java.exe',
    ];

    for (const javaPath of commonPaths) {
      try {
        execSync(`"${javaPath}" -version`, { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
        logger.info(`Found Java at: ${javaPath}`);
        return javaPath;
      } catch {}
    }
  }

  return javaCmd;
}

export class HytaleAdapter extends BaseAdapter {
  private static readonly DEFAULT_CONFIG = {
    ServerName: 'Hytale Server',
    MOTD: 'Welcome to Hytale!',
    MaxPlayers: 100,
    MaxViewRadius: 12,
  };

  async install(config: InstallConfig): Promise<InstallResult> {
    try {
      logger.info(`Installing Hytale server: ${config.name}`);

      await mkdir(config.installPath, { recursive: true });

      const configPath = path.join(config.installPath, 'config.json');
      const gameConfig = {
        ...HytaleAdapter.DEFAULT_CONFIG,
        ServerName: config.name,
        MaxPlayers: config.maxPlayers,
      };

      await writeFile(configPath, JSON.stringify(gameConfig, null, 2));

      logger.info(`Hytale server installed at: ${config.installPath}`);

      return {
        success: true,
        path: config.installPath,
        version: config.version || 'unknown',
      };
    } catch (error) {
      logger.error({ error }, 'Failed to install Hytale server');
      return {
        success: false,
        path: config.installPath,
        version: 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning()) {
      throw new Error('Server is already running');
    }

    this.setStatus('starting');
    this.clearLogBuffer();
    this.emitLog(`Starting server...`);
    logger.info(`Starting Hytale server: ${this.server.id}`);

    const jarPath = path.join(this.server.path, 'HytaleServer.jar');
    const assetsPath = path.join(this.server.path, 'Assets.zip');

    const serverPathExists = await this.fileExists(this.server.path);
    if (!serverPathExists) {
      const errorMsg = `Server directory not found: ${this.server.path}`;
      this.emitLog(`[ERROR] ${errorMsg}`);
      logger.error(errorMsg);
      this.setStatus('crashed');
      throw new Error(errorMsg);
    }

    const jarExists = await this.fileExists(jarPath);
    if (!jarExists) {
      const errorMsg = `HytaleServer.jar not found at: ${jarPath}`;
      this.emitLog(`[ERROR] ${errorMsg}`);
      this.emitLog(`[INFO] Please place HytaleServer.jar in the server directory`);
      logger.error(errorMsg);
      this.setStatus('crashed');
      throw new Error(errorMsg);
    }

    const assetsExists = await this.fileExists(assetsPath);
    if (!assetsExists) {
      const errorMsg = `Assets.zip not found at: ${assetsPath}`;
      this.emitLog(`[ERROR] ${errorMsg}`);
      this.emitLog(`[INFO] Please place Assets.zip in the server directory`);
      logger.error(errorMsg);
      this.setStatus('crashed');
      throw new Error(errorMsg);
    }

    const javaCmd = findJavaPath();
    this.emitLog(`[INFO] Using Java: ${javaCmd}`);

    const args = [
      '-Xms6G',
      '-Xmx6G',
      '-XX:+UseG1GC',
      '-XX:AOTCache=HytaleServer.aot',
      '-jar',
      jarPath,
      '--assets',
      assetsPath,
    ];

    this.emitLog(`Executing: ${javaCmd} ${args.join(' ')}`);
    logger.info(`Command: ${javaCmd} ${args.join(' ')}`);

    try {
      this.process = spawn(javaCmd, args, {
        cwd: this.server.path,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.stdout?.on('data', (data) => {
        const line = data.toString().trim();
        if (line) {
          logger.debug(`[${this.server.id}] ${stripAnsi(line)}`);
          this.emitLog(line);
        }
      });

      this.process.stderr?.on('data', (data) => {
        const line = data.toString().trim();
        if (line) {
          logger.error(`[${this.server.id}] ${stripAnsi(line)}`);
          this.emitLog(line);
        }
      });

      this.process.on('exit', (code, signal) => {
        const exitMsg = `Server exited with code ${code}, signal ${signal}`;
        logger.info(`Server ${this.server.id}: ${exitMsg}`);
        this.emitLog(`[INFO] ${exitMsg}`);
        this.process = null;

        if (code !== 0 && signal !== 'SIGTERM') {
          this.emitLog(`[ERROR] Server crashed unexpectedly`);
          this.setStatus('crashed');
        } else {
          this.setStatus('stopped');
        }
      });

      this.process.on('error', (error) => {
        const errorMsg = error.message || 'Unknown process error';
        logger.error(`Server ${this.server.id} process error: ${errorMsg}`);
        this.emitLog(`[ERROR] Process error: ${errorMsg}`);
        if (error.message.includes('ENOENT')) {
          this.emitLog(`[ERROR] Java not found. Please install Java and ensure it's in your PATH`);
        }
        this.setStatus('crashed');
        this.process = null;
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (this.process) {
        this.setStatus('running');
        this.emitLog(`Server started successfully`);
        logger.info(`Server ${this.server.id} started successfully`);
      } else {
        throw new Error('Process failed to start - check logs above for details');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.emitLog(`[ERROR] Failed to start: ${errorMsg}`);
      this.setStatus('crashed');
      logger.error(`Failed to start server ${this.server.id}: ${errorMsg}`);
      throw error;
    }
  }

  async stop(timeout: number = 30000): Promise<void> {
    if (!this.process) {
      logger.warn(`Server ${this.server.id} is not running`);
      return;
    }

    this.setStatus('stopping');
    this.emitLog('[INFO] Stopping server...');
    logger.info(`Stopping server: ${this.server.id}`);

    return new Promise((resolve) => {
      if (!this.process) {
        resolve();
        return;
      }

      const processToStop = this.process;

      const killTimeout = setTimeout(() => {
        if (processToStop && !processToStop.killed) {
          logger.warn(`Force killing server ${this.server.id}`);
          processToStop.kill('SIGKILL');
        }
      }, timeout);

      const sigTermTimeout = setTimeout(() => {
        if (processToStop && !processToStop.killed) {
          processToStop.kill('SIGTERM');
        }
      }, 5000);

      processToStop.once('exit', () => {
        clearTimeout(killTimeout);
        clearTimeout(sigTermTimeout);
        this.process = null;
        this.setStatus('stopped');
        this.emitLog('[INFO] Server stopped');
        logger.info(`Server ${this.server.id} stopped`);
        resolve();
      });

      processToStop.stdin?.write('stop\n');
    });
  }

  async getConfig(): Promise<GameConfig> {
    const configPath = path.join(this.server.path, 'config.json');
    const content = await readFile(configPath, 'utf-8');
    return JSON.parse(content);
  }

  async updateConfig(config: Partial<GameConfig>): Promise<void> {
    const currentConfig = await this.getConfig();
    const newConfig = { ...currentConfig, ...config };

    const configPath = path.join(this.server.path, 'config.json');
    await writeFile(configPath, JSON.stringify(newConfig, null, 2));

    logger.info(`Updated config for server ${this.server.id}`);
  }
}
