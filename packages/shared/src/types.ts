export type GameType = 'hytale' | 'minecraft';

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed';

export interface Server {
  id: string;
  name: string;
  gameType: GameType;
  status: ServerStatus;
  port: number;
  maxPlayers: number;
  path: string;
  version?: string;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PerformanceMetrics {
  cpu: number;
  memory: number;
  uptime: number;
  players: number;
}

export interface InstallConfig {
  name: string;
  port: number;
  maxPlayers: number;
  version?: string;
  installPath: string;
}

export interface InstallResult {
  success: boolean;
  path: string;
  version: string;
  error?: string;
}

export interface GameConfig {
  ServerName: string;
  MOTD: string;
  MaxPlayers: number;
  MaxViewRadius: number;
  [key: string]: unknown;
}
