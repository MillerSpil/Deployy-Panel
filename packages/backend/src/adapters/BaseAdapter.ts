import { EventEmitter } from 'node:events';
import type {
  Server,
  InstallConfig,
  InstallResult,
  GameConfig,
  PerformanceMetrics,
  ServerStatus,
} from '@deployy/shared';
import type { ChildProcess } from 'node:child_process';

interface LogEntry {
  line: string;
  timestamp: string;
}

const MAX_LOGS = 1000;

/** Default timeout for external HTTP requests (15 seconds) */
export const FETCH_TIMEOUT_MS = 15_000;

/** Helper to create a fetch request with a timeout */
export function fetchWithTimeout(url: string, options?: RequestInit, timeoutMs: number = FETCH_TIMEOUT_MS): Promise<Response> {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export abstract class BaseAdapter extends EventEmitter {
  protected process: ChildProcess | null = null;
  protected status: ServerStatus = 'stopped';
  protected logBuffer: LogEntry[] = [];
  private _updating = false;

  constructor(protected server: Server) {
    super();
  }

  abstract install(config: InstallConfig): Promise<InstallResult>;
  abstract start(): Promise<void>;
  abstract stop(timeout?: number): Promise<void>;
  abstract getConfig(): Promise<GameConfig>;
  abstract updateConfig(config: Partial<GameConfig>): Promise<void>;

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  isRunning(): boolean {
    return this.process !== null && this.status === 'running';
  }

  getStatus(): ServerStatus {
    return this.status;
  }

  protected setStatus(status: ServerStatus): void {
    this.status = status;
    this.emit('status', status);
  }

  protected emitLog(line: string): void {
    const entry: LogEntry = { line, timestamp: new Date().toISOString() };
    this.logBuffer.push(entry);
    if (this.logBuffer.length > MAX_LOGS) {
      this.logBuffer = this.logBuffer.slice(-MAX_LOGS);
    }
    this.emit('log', line);
  }

  getLogBuffer(): LogEntry[] {
    return [...this.logBuffer];
  }

  clearLogBuffer(): void {
    this.logBuffer = [];
  }

  async getMetrics(): Promise<PerformanceMetrics> {
    return {
      cpu: 0,
      memory: 0,
      uptime: 0,
      players: 0,
    };
  }

  async getLogs(lines: number = 100): Promise<string[]> {
    return [];
  }

  /** Returns true if an update/download operation is in progress */
  get isUpdating(): boolean {
    return this._updating;
  }

  /** Acquire the update lock. Throws if already updating or server is running. */
  protected acquireUpdateLock(): void {
    if (this._updating) {
      throw new Error('An update is already in progress for this server');
    }
    if (this.isRunning()) {
      throw new Error('Server must be stopped before updating');
    }
    this._updating = true;
  }

  /** Release the update lock */
  protected releaseUpdateLock(): void {
    this._updating = false;
  }

  /**
   * Update the game server to a new version.
   * Override in subclasses that support updates.
   */
  async update(targetVersion?: string): Promise<{ success: boolean; version: string; error?: string }> {
    return { success: false, version: '', error: 'Updates not supported for this game type' };
  }

  sendCommand(command: string): boolean {
    if (!this.process?.stdin) {
      return false;
    }
    this.process.stdin.write(command + '\n');
    this.emitLog(`> ${command}`);
    return true;
  }
}
