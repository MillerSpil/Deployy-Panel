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

export abstract class BaseAdapter extends EventEmitter {
  protected process: ChildProcess | null = null;
  protected status: ServerStatus = 'stopped';
  protected logBuffer: LogEntry[] = [];

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

  sendCommand(command: string): boolean {
    if (!this.process?.stdin) {
      return false;
    }
    this.process.stdin.write(command + '\n');
    this.emitLog(`> ${command}`);
    return true;
  }
}
