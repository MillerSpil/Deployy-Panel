/**
 * Java detection utilities shared across game adapters.
 */

import { execSync, spawnSync } from 'node:child_process';
import os from 'node:os';
import { logger } from './logger.js';

/**
 * Validate that a path doesn't contain shell metacharacters.
 * Prevents command injection when using the path.
 */
export function isValidJavaPath(javaPath: string): boolean {
  const safePathRegex = /^[a-zA-Z0-9\s\-_./\\:]+$/;
  return safePathRegex.test(javaPath);
}

/**
 * Find the Java executable path.
 * Searches PATH first, then common installation locations.
 */
export function findJavaPath(): string {
  const isWindows = os.platform() === 'win32';
  const javaCmd = isWindows ? 'java.exe' : 'java';

  // Try PATH first
  try {
    const whereCmd = isWindows ? 'where java' : 'which java';
    const result = execSync(whereCmd, { encoding: 'utf-8', timeout: 5000 }).trim();
    if (result) {
      const firstPath = result.split('\n')[0].trim();
      if (!isValidJavaPath(firstPath)) {
        logger.warn('Java path from PATH contains invalid characters, ignoring', { path: firstPath });
      } else {
        logger.info(`Found Java at: ${firstPath}`);
        return firstPath;
      }
    }
  } catch {
    logger.warn('Java not found in PATH, checking common locations...');
  }

  // Check common installation locations
  if (isWindows) {
    const commonPaths = [
      'C:\\Program Files\\Java\\jdk-25.0.2\\bin\\java.exe',
      'C:\\Program Files\\Java\\jdk-21\\bin\\java.exe',
      'C:\\Program Files\\Java\\jdk-17\\bin\\java.exe',
      'C:\\Program Files\\Eclipse Adoptium\\jdk-21\\bin\\java.exe',
      'C:\\Program Files\\Eclipse Adoptium\\jdk-17\\bin\\java.exe',
      'C:\\Program Files\\Microsoft\\jdk-17\\bin\\java.exe',
      'C:\\Program Files\\Zulu\\zulu-21\\bin\\java.exe',
      'C:\\Program Files\\Zulu\\zulu-17\\bin\\java.exe',
    ];

    for (const javaPath of commonPaths) {
      try {
        const result = spawnSync(javaPath, ['-version'], {
          encoding: 'utf-8',
          timeout: 5000,
          stdio: 'pipe',
        });
        if (result.status === 0 || result.stderr?.includes('version')) {
          logger.info(`Found Java at: ${javaPath}`);
          return javaPath;
        }
      } catch {
        // Continue to next path
      }
    }
  } else {
    // Linux/macOS common paths
    const commonPaths = [
      '/usr/bin/java',
      '/usr/lib/jvm/java-25-openjdk/bin/java',
      '/usr/lib/jvm/java-21-openjdk/bin/java',
      '/usr/lib/jvm/java-17-openjdk/bin/java',
      '/opt/java/openjdk/bin/java',
    ];

    for (const javaPath of commonPaths) {
      try {
        const result = spawnSync(javaPath, ['-version'], {
          encoding: 'utf-8',
          timeout: 5000,
          stdio: 'pipe',
        });
        if (result.status === 0 || result.stderr?.includes('version')) {
          logger.info(`Found Java at: ${javaPath}`);
          return javaPath;
        }
      } catch {
        // Continue to next path
      }
    }
  }

  // Fallback to hoping it's in PATH
  return javaCmd;
}

/**
 * Get Aikar's optimized JVM flags for Paper/Spigot servers.
 * These flags are recommended for Minecraft servers to improve GC performance.
 */
export function getAikarFlags(ram: string): string[] {
  const ramMb = parseInt(ram) * 1024;

  return [
    `-Xms${ram}`,
    `-Xmx${ram}`,
    '-XX:+UseG1GC',
    '-XX:+ParallelRefProcEnabled',
    '-XX:MaxGCPauseMillis=200',
    '-XX:+UnlockExperimentalVMOptions',
    '-XX:+DisableExplicitGC',
    '-XX:+AlwaysPreTouch',
    `-XX:G1NewSizePercent=${ramMb < 12288 ? '30' : '40'}`,
    `-XX:G1MaxNewSizePercent=${ramMb < 12288 ? '40' : '50'}`,
    '-XX:G1HeapRegionSize=8M',
    '-XX:G1ReservePercent=20',
    '-XX:G1HeapWastePercent=5',
    '-XX:G1MixedGCCountTarget=4',
    '-XX:InitiatingHeapOccupancyPercent=15',
    '-XX:G1MixedGCLiveThresholdPercent=90',
    '-XX:G1RSetUpdatingPauseTimePercent=5',
    '-XX:SurvivorRatio=32',
    '-XX:+PerfDisableSharedMem',
    '-XX:MaxTenuringThreshold=1',
    '-Dusing.aikars.flags=https://mcflags.emc.gs',
    '-Daikars.new.flags=true',
  ];
}

/**
 * Get standard JVM flags for vanilla Minecraft servers.
 */
export function getVanillaFlags(ram: string): string[] {
  return [
    `-Xms${ram}`,
    `-Xmx${ram}`,
    '-XX:+UseG1GC',
    '-XX:+ParallelRefProcEnabled',
    '-XX:MaxGCPauseMillis=200',
  ];
}
