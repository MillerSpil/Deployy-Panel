import { BaseAdapter, fetchWithTimeout } from './BaseAdapter.js';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, access, rename, unlink } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import type { InstallConfig, InstallResult, GameConfig, MinecraftFlavor } from '@deployy/shared';
import { logger } from '../utils/logger.js';
import { findJavaPath, getAikarFlags, getVanillaFlags } from '../utils/java.js';
import { parseProperties, serializeProperties, createDefaultProperties } from '../utils/properties.js';

function stripAnsi(str: string): string {
  return str.replace(/(\x1B\[[0-9;]*[a-zA-Z]|\[[\d;]*m)/g, '');
}

interface MinecraftConfig {
  flavor: MinecraftFlavor;
  version: string;
  ram: number;
}

export class MinecraftAdapter extends BaseAdapter {
  private get minecraftConfig(): MinecraftConfig {
    const config = this.server.config as Record<string, unknown>;
    return {
      flavor: (config.flavor as MinecraftFlavor) || 'vanilla',
      version: (config.version as string) || 'latest',
      ram: (config.ram as number) || 4,
    };
  }

  async install(config: InstallConfig): Promise<InstallResult> {
    try {
      const flavor = config.flavor || 'vanilla';
      const version = config.version || 'latest';

      logger.info(`Installing Minecraft ${flavor} server: ${config.name}`, { version });

      await mkdir(config.installPath, { recursive: true });

      // Create server.properties
      const propsContent = createDefaultProperties(
        config.port,
        config.maxPlayers,
        `${config.name} - Powered by Deployy`
      );
      await writeFile(path.join(config.installPath, 'server.properties'), propsContent);

      // Create eula.txt (auto-accept)
      await writeFile(path.join(config.installPath, 'eula.txt'), 'eula=true\n');

      // Download the server JAR
      const jarUrl = await this.getJarDownloadUrl(flavor, version);
      const jarPath = path.join(config.installPath, 'server.jar');

      logger.info(`Downloading server JAR from: ${jarUrl}`);
      await this.downloadFileAtomic(jarUrl, jarPath);

      // Determine actual version if 'latest' was requested
      let actualVersion = version;
      if (version === 'latest') {
        actualVersion = await this.getLatestVersion(flavor);
      }

      logger.info(`Minecraft ${flavor} server installed at: ${config.installPath}`);

      return {
        success: true,
        path: config.installPath,
        version: actualVersion,
      };
    } catch (error) {
      logger.error('Failed to install Minecraft server', { error });
      return {
        success: false,
        path: config.installPath,
        version: config.version || 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update the server JAR to the latest version (or specified version).
   * Uses a lock to prevent concurrent updates and checks server is stopped.
   */
  async update(targetVersion?: string): Promise<{ success: boolean; version: string; error?: string }> {
    const { flavor, version: currentVersion } = this.minecraftConfig;
    const newVersion = targetVersion || 'latest';

    this.acquireUpdateLock();

    try {
      this.emit('update:progress', { status: 'checking_version', message: 'Checking for updates...' });

      // Get the download URL for the target version
      const jarUrl = await this.getJarDownloadUrl(flavor, newVersion);
      const jarPath = path.join(this.server.path, 'server.jar');

      // Determine actual version
      let actualVersion = newVersion;
      if (newVersion === 'latest') {
        actualVersion = await this.getLatestVersion(flavor);
      }

      this.emit('update:progress', {
        status: 'downloading',
        message: `Downloading ${flavor} ${actualVersion}...`,
      });

      logger.info(`Updating Minecraft server to ${actualVersion}`, { flavor, jarUrl });

      // Atomic download — writes to temp file, then renames
      await this.downloadFileAtomic(jarUrl, jarPath);

      this.emit('update:progress', {
        status: 'completed',
        message: `Successfully updated to ${flavor} ${actualVersion}`,
      });

      logger.info(`Minecraft server updated to ${actualVersion}`);

      return { success: true, version: actualVersion };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.emit('update:progress', { status: 'error', message: errorMsg });
      logger.error('Failed to update Minecraft server', { error });
      return { success: false, version: currentVersion, error: errorMsg };
    } finally {
      this.releaseUpdateLock();
    }
  }

  private async getJarDownloadUrl(flavor: MinecraftFlavor, version: string): Promise<string> {
    if (flavor === 'paper') {
      return this.getPaperDownloadUrl(version);
    }
    return this.getVanillaDownloadUrl(version);
  }

  private async getVanillaDownloadUrl(version: string): Promise<string> {
    const manifestRes = await fetchWithTimeout(
      'https://launchermeta.mojang.com/mc/game/version_manifest.json'
    );
    if (!manifestRes.ok) {
      throw new Error(`Failed to fetch Minecraft version manifest: ${manifestRes.status}`);
    }
    const manifest = await manifestRes.json() as {
      latest: { release: string; snapshot: string };
      versions: { id: string; type: string; url: string }[];
    };

    const targetVersion = version === 'latest' ? manifest.latest.release : version;
    const versionInfo = manifest.versions.find((v) => v.id === targetVersion);

    if (!versionInfo) {
      throw new Error(`Minecraft version ${targetVersion} not found`);
    }

    const versionRes = await fetchWithTimeout(versionInfo.url);
    if (!versionRes.ok) {
      throw new Error(`Failed to fetch version details: ${versionRes.status}`);
    }
    const versionData = await versionRes.json() as {
      downloads: { server: { url: string; size?: number; sha1?: string } };
    };

    return versionData.downloads.server.url;
  }

  private async getPaperDownloadUrl(version: string): Promise<string> {
    const versionsRes = await fetchWithTimeout('https://api.papermc.io/v2/projects/paper');
    if (!versionsRes.ok) {
      throw new Error(`Failed to fetch Paper versions: ${versionsRes.status}`);
    }
    const versionsData = await versionsRes.json() as { versions: string[] };

    const targetVersion = version === 'latest'
      ? versionsData.versions[versionsData.versions.length - 1]
      : version;

    if (!versionsData.versions.includes(targetVersion)) {
      throw new Error(`Paper version ${targetVersion} not found`);
    }

    const buildsRes = await fetchWithTimeout(
      `https://api.papermc.io/v2/projects/paper/versions/${targetVersion}`
    );
    if (!buildsRes.ok) {
      throw new Error(`Failed to fetch Paper builds: ${buildsRes.status}`);
    }
    const buildsData = await buildsRes.json() as { builds: number[] };

    const latestBuild = buildsData.builds[buildsData.builds.length - 1];

    const buildRes = await fetchWithTimeout(
      `https://api.papermc.io/v2/projects/paper/versions/${targetVersion}/builds/${latestBuild}`
    );
    if (!buildRes.ok) {
      throw new Error(`Failed to fetch Paper build info: ${buildRes.status}`);
    }
    const buildData = await buildRes.json() as {
      downloads: { application: { name: string } };
    };

    const fileName = buildData.downloads.application.name;
    return `https://api.papermc.io/v2/projects/paper/versions/${targetVersion}/builds/${latestBuild}/downloads/${fileName}`;
  }

  private async getLatestVersion(flavor: MinecraftFlavor): Promise<string> {
    if (flavor === 'paper') {
      const res = await fetchWithTimeout('https://api.papermc.io/v2/projects/paper');
      if (!res.ok) throw new Error(`Failed to fetch Paper versions: ${res.status}`);
      const data = await res.json() as { versions: string[] };
      return data.versions[data.versions.length - 1];
    }

    const res = await fetchWithTimeout(
      'https://launchermeta.mojang.com/mc/game/version_manifest.json'
    );
    if (!res.ok) throw new Error(`Failed to fetch Minecraft versions: ${res.status}`);
    const data = await res.json() as { latest: { release: string } };
    return data.latest.release;
  }

  /**
   * Download a file to destPath atomically.
   * Streams to a temp file first, then renames — prevents corrupted JARs
   * if the download fails mid-way.
   */
  private async downloadFileAtomic(url: string, destPath: string): Promise<void> {
    const tempPath = `${destPath}.tmp.${Date.now()}`;

    try {
      // Use a longer timeout for large file downloads (5 minutes)
      const response = await fetchWithTimeout(url, undefined, 5 * 60 * 1000);
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is empty');
      }

      // Stream to temp file instead of buffering in memory
      const fileStream = createWriteStream(tempPath);
      const webStream = Readable.fromWeb(response.body as any);
      await pipeline(webStream, fileStream);

      // Atomic rename — if this fails the original file is untouched
      await rename(tempPath, destPath);
    } catch (error) {
      // Clean up temp file on failure
      try {
        await unlink(tempPath);
      } catch {
        // Temp file may not exist, that's fine
      }
      throw error;
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

    if (this.isUpdating) {
      throw new Error('Cannot start server while an update is in progress');
    }

    this.setStatus('starting');
    this.clearLogBuffer();
    this.emitLog('Starting Minecraft server...');

    const { flavor, ram } = this.minecraftConfig;
    const jarPath = path.join(this.server.path, 'server.jar');

    // Validate server files exist
    const pathExists = await this.fileExists(this.server.path);
    if (!pathExists) {
      const errorMsg = `Server directory not found: ${this.server.path}`;
      this.emitLog(`[ERROR] ${errorMsg}`);
      this.setStatus('crashed');
      throw new Error(errorMsg);
    }

    const jarExists = await this.fileExists(jarPath);
    if (!jarExists) {
      const errorMsg = `server.jar not found at: ${jarPath}`;
      this.emitLog(`[ERROR] ${errorMsg}`);
      this.emitLog('[INFO] Please ensure the server JAR has been downloaded');
      this.setStatus('crashed');
      throw new Error(errorMsg);
    }

    const javaCmd = findJavaPath();
    const ramStr = `${ram}G`;
    this.emitLog(`[INFO] Using Java: ${javaCmd}`);
    this.emitLog(`[INFO] Flavor: ${flavor}, RAM: ${ram}GB`);

    // Build JVM arguments based on flavor
    const jvmFlags = flavor === 'paper' ? getAikarFlags(ramStr) : getVanillaFlags(ramStr);
    const args = [...jvmFlags, '-jar', 'server.jar', 'nogui'];

    this.emitLog(`Executing: ${javaCmd} ${args.join(' ')}`);
    logger.info(`Starting Minecraft server: ${javaCmd} ${args.join(' ')}`);

    try {
      this.process = spawn(javaCmd, args, {
        cwd: this.server.path,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Use a promise that resolves on successful start or rejects on early failure
      const startResult = await new Promise<void>((resolve, reject) => {
        let resolved = false;
        const resolveOnce = () => {
          if (!resolved) { resolved = true; resolve(); }
        };
        const rejectOnce = (err: Error) => {
          if (!resolved) { resolved = true; reject(err); }
        };

        this.process!.stdout?.on('data', (data) => {
          const lines = data.toString().split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) {
              logger.debug(`[${this.server.id}] ${stripAnsi(trimmed)}`);
              this.emitLog(trimmed);
            }
          }
        });

        this.process!.stderr?.on('data', (data) => {
          const lines = data.toString().split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) {
              logger.debug(`[${this.server.id}] ${stripAnsi(trimmed)}`);
              this.emitLog(trimmed);
            }
          }
        });

        this.process!.on('exit', (code, signal) => {
          const exitMsg = `Server exited with code ${code}, signal ${signal}`;
          logger.info(`Server ${this.server.id}: ${exitMsg}`);
          this.emitLog(`[INFO] ${exitMsg}`);
          this.process = null;

          if (code !== 0 && signal !== 'SIGTERM') {
            this.emitLog('[ERROR] Server crashed unexpectedly');
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
            this.emitLog('[ERROR] Java not found. Please install Java 17+ and ensure it\'s in your PATH');
          }
          this.setStatus('crashed');
          this.process = null;
          rejectOnce(new Error(errorMsg));
        });

        // If the process survives 3 seconds, consider it started
        setTimeout(() => {
          if (this.process) {
            resolveOnce();
          }
        }, 3000);
      });

      this.setStatus('running');
      this.emitLog('Server started successfully');
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
    const propsPath = path.join(this.server.path, 'server.properties');

    try {
      const content = await readFile(propsPath, 'utf-8');
      const { properties } = parseProperties(content);

      // Convert to GameConfig format with friendly names
      return {
        ServerName: properties['motd'] || 'Minecraft Server',
        MOTD: properties['motd'] || 'A Minecraft Server',
        MaxPlayers: parseInt(properties['max-players'] || '20', 10),
        MaxViewRadius: parseInt(properties['view-distance'] || '10', 10),
        // Include all other properties
        ...Object.fromEntries(
          Object.entries(properties).map(([key, value]) => {
            // Try to convert numeric strings to numbers
            if (/^\d+$/.test(value)) {
              return [key, parseInt(value, 10)];
            }
            // Convert boolean strings
            if (value === 'true') return [key, true];
            if (value === 'false') return [key, false];
            return [key, value];
          })
        ),
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Return defaults if file doesn't exist
        return {
          ServerName: 'Minecraft Server',
          MOTD: 'A Minecraft Server',
          MaxPlayers: 20,
          MaxViewRadius: 10,
        };
      }
      throw error;
    }
  }

  async updateConfig(config: Partial<GameConfig>): Promise<void> {
    const propsPath = path.join(this.server.path, 'server.properties');

    // Read existing properties
    let existingProps: Record<string, string> = {};
    let comments: string[] = [];

    try {
      const content = await readFile(propsPath, 'utf-8');
      const parsed = parseProperties(content);
      existingProps = parsed.properties;
      comments = parsed.comments;
    } catch {
      // File doesn't exist, start fresh
    }

    // Merge new config
    for (const [key, value] of Object.entries(config)) {
      // Map friendly names back to property names
      if (key === 'MOTD' || key === 'ServerName') {
        existingProps['motd'] = String(value);
      } else if (key === 'MaxPlayers') {
        existingProps['max-players'] = String(value);
      } else if (key === 'MaxViewRadius') {
        existingProps['view-distance'] = String(value);
      } else {
        // Direct property update
        existingProps[key] = String(value);
      }
    }

    // Write back
    const newContent = serializeProperties(existingProps, comments);
    await writeFile(propsPath, newContent);

    logger.info(`Updated config for server ${this.server.id}`);
  }
}
