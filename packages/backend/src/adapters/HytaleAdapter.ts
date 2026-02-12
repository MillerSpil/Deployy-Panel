import { BaseAdapter } from './BaseAdapter.js';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import type { InstallConfig, InstallResult, GameConfig } from '@deployy/shared';
import { logger } from '../utils/logger.js';
import { findJavaPath } from '../utils/java.js';

function stripAnsi(str: string): string {
  return str.replace(/(\x1B\[[0-9;]*[a-zA-Z]|\[[\d;]*m)/g, '');
}

export class HytaleAdapter extends BaseAdapter {
  private static readonly DEFAULT_CONFIG = {
    ServerName: 'Hytale Server',
    MOTD: 'Welcome to Hytale!',
    MaxPlayers: 100,
    MaxViewRadius: 12,
  };

  private get ram(): number {
    const config = this.server.config as Record<string, unknown>;
    return (config.ram as number) || 6;
  }

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
      logger.error('Failed to install Hytale server', { error });
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

    // Server files are in Server/ subfolder, Assets.zip is at root
    const serverSubfolder = path.join(this.server.path, 'Server');
    const jarPath = path.join(serverSubfolder, 'HytaleServer.jar');
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
      this.emitLog(`[INFO] Please ensure server files are downloaded (Server/HytaleServer.jar)`);
      logger.error(errorMsg);
      this.setStatus('crashed');
      throw new Error(errorMsg);
    }

    const assetsExists = await this.fileExists(assetsPath);
    if (!assetsExists) {
      const errorMsg = `Assets.zip not found at: ${assetsPath}`;
      this.emitLog(`[ERROR] ${errorMsg}`);
      this.emitLog(`[INFO] Please ensure Assets.zip is in the server directory`);
      logger.error(errorMsg);
      this.setStatus('crashed');
      throw new Error(errorMsg);
    }

    const javaCmd = findJavaPath();
    const ram = this.ram;
    const ramStr = `${ram}G`;
    this.emitLog(`[INFO] Using Java: ${javaCmd}`);
    this.emitLog(`[INFO] RAM: ${ram}GB`);

    const args = [
      `-Xms${ramStr}`,
      `-Xmx${ramStr}`,
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
      // Run from Server/ subfolder so AOT cache works correctly
      this.process = spawn(javaCmd, args, {
        cwd: serverSubfolder,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Use a promise that resolves on successful start or rejects on early failure
      await new Promise<void>((resolve, reject) => {
        let resolved = false;
        const resolveOnce = () => {
          if (!resolved) { resolved = true; resolve(); }
        };
        const rejectOnce = (err: Error) => {
          if (!resolved) { resolved = true; reject(err); }
        };

        this.process!.stdout?.on('data', (data) => {
          const line = data.toString().trim();
          if (line) {
            logger.debug(`[${this.server.id}] ${stripAnsi(line)}`);
            this.emitLog(line);
          }
        });

        this.process!.stderr?.on('data', (data) => {
          const line = data.toString().trim();
          if (line) {
            // stderr isn't always errors — Java writes info here too
            logger.debug(`[${this.server.id}] ${stripAnsi(line)}`);
            this.emitLog(line);
          }
        });

        this.process!.on('exit', (code, signal) => {
          const exitMsg = `Server exited with code ${code}, signal ${signal}`;
          logger.info(`Server ${this.server.id}: ${exitMsg}`);
          this.emitLog(`[INFO] ${exitMsg}`);
          this.process = null;

          if (code !== 0 && signal !== 'SIGTERM') {
            this.emitLog(`[ERROR] Server crashed unexpectedly`);
            this.setStatus('crashed');
            rejectOnce(new Error(`Server exited with code ${code}`));
          } else {
            this.setStatus('stopped');
          }
        });

        this.process!.on('error', (error) => {
          const errorMsg = error.message || 'Unknown process error';
          logger.error(`Server ${this.server.id} process error: ${errorMsg}`);
          this.emitLog(`[ERROR] Process error: ${errorMsg}`);
          if (error.message.includes('ENOENT')) {
            this.emitLog(`[ERROR] Java not found. Please install Java and ensure it's in your PATH`);
          }
          this.setStatus('crashed');
          this.process = null;
          rejectOnce(new Error(errorMsg));
        });

        // If the process survives 2 seconds, consider it started
        setTimeout(() => {
          if (this.process) {
            resolveOnce();
          }
        }, 2000);
      });

      this.setStatus('running');
      this.emitLog(`Server started successfully`);
      logger.info(`Server ${this.server.id} started successfully`);
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

      // Escalation chain: stop command → SIGTERM → SIGKILL
      // Step 1: Send "stop" command via stdin
      const stdinOk = processToStop.stdin?.writable;
      if (stdinOk) {
        processToStop.stdin!.write('stop\n');
        this.emitLog('[INFO] Sent stop command');
      } else {
        this.emitLog('[WARN] stdin not writable, escalating to SIGTERM');
      }

      // Step 2: SIGTERM after half the timeout if stop command didn't work
      const halfTimeout = Math.floor(timeout / 2);
      const sigTermTimeout = setTimeout(() => {
        if (processToStop && !processToStop.killed) {
          this.emitLog('[WARN] Server did not respond to stop command, sending SIGTERM...');
          processToStop.kill('SIGTERM');
        }
      }, stdinOk ? halfTimeout : 0);

      // Step 3: SIGKILL at the full timeout as last resort
      const killTimeout = setTimeout(() => {
        if (processToStop && !processToStop.killed) {
          logger.warn(`Force killing server ${this.server.id}`);
          this.emitLog('[WARN] Server did not stop gracefully, force killing...');
          processToStop.kill('SIGKILL');
        }
      }, timeout);

      processToStop.once('exit', () => {
        clearTimeout(killTimeout);
        clearTimeout(sigTermTimeout);
        this.process = null;
        this.setStatus('stopped');
        this.emitLog('[INFO] Server stopped');
        logger.info(`Server ${this.server.id} stopped`);
        resolve();
      });
    });
  }

  async getConfig(): Promise<GameConfig> {
    const configPath = path.join(this.server.path, 'config.json');

    try {
      const content = await readFile(configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { ...HytaleAdapter.DEFAULT_CONFIG };
      }
      throw error;
    }
  }

  async updateConfig(config: Partial<GameConfig>): Promise<void> {
    const currentConfig = await this.getConfig();
    const newConfig = { ...currentConfig, ...config };

    const configPath = path.join(this.server.path, 'config.json');
    await writeFile(configPath, JSON.stringify(newConfig, null, 2));

    logger.info(`Updated config for server ${this.server.id}`);
  }
}
