import type { PerformanceMetrics, HytaleDownloadStatus, MinecraftDownloadStatus, UpdateStatus, EnvMergeResult, BackupRestoreStage } from './types';

export interface ClientToServerEvents {
  'subscribe:server': (data: { serverId: string }) => void;
  'unsubscribe:server': (data: { serverId: string }) => void;
  command: (data: { serverId: string; command: string }) => void;
  'hytale:download:subscribe': (data: { serverId: string }) => void;
  'hytale:download:unsubscribe': (data: { serverId: string }) => void;
  'minecraft:download:subscribe': (data: { serverId: string }) => void;
  'minecraft:download:unsubscribe': (data: { serverId: string }) => void;
  'update:subscribe': () => void;
  'update:unsubscribe': () => void;
}

export interface ServerToClientEvents {
  'server:log': (data: { serverId: string; line: string; timestamp: string }) => void;
  'server:status': (data: { serverId: string; status: string }) => void;
  'server:metrics': (data: { serverId: string; metrics: PerformanceMetrics }) => void;
  'hytale:download:progress': (data: {
    serverId: string;
    status: HytaleDownloadStatus;
    message: string;
    authUrl?: string;
  }) => void;
  'hytale:download:log': (data: { serverId: string; line: string; timestamp: string }) => void;
  'minecraft:download:progress': (data: {
    serverId: string;
    status: MinecraftDownloadStatus;
    message: string;
  }) => void;
  'minecraft:download:log': (data: { serverId: string; line: string; timestamp: string }) => void;
  'update:progress': (data: {
    status: UpdateStatus;
    message: string;
    progress?: number;
    envChanges?: EnvMergeResult;
  }) => void;
  'backup:restore:progress': (data: {
    serverId: string;
    stage: BackupRestoreStage;
    message: string;
  }) => void;
  error: (data: { message: string; code?: string }) => void;
}
