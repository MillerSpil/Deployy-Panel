import type { PerformanceMetrics } from './types';

export interface ClientToServerEvents {
  'subscribe:server': (data: { serverId: string }) => void;
  'unsubscribe:server': (data: { serverId: string }) => void;
  command: (data: { serverId: string; command: string }) => void;
}

export interface ServerToClientEvents {
  'server:log': (data: { serverId: string; line: string; timestamp: string }) => void;
  'server:status': (data: { serverId: string; status: string }) => void;
  'server:metrics': (data: { serverId: string; metrics: PerformanceMetrics }) => void;
  error: (data: { message: string; code?: string }) => void;
}
