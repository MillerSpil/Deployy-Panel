import { apiRequest } from './client';
import type { Server, ServerWithPermissions, GameConfig } from '@deployy/shared';

export interface ConfigResponse {
  config: GameConfig;
  isRunning: boolean;
  restartRequired?: boolean;
}

export const serversApi = {
  list: () => apiRequest<Server[]>('/servers'),

  get: (id: string) => apiRequest<ServerWithPermissions>(`/servers/${id}`),

  create: (data: {
    name: string;
    gameType: string;
    path: string;
    port: number;
    maxPlayers: number;
    autoDownload?: boolean;
    flavor?: string;
    version?: string;
    ram?: number;
  }) =>
    apiRequest<Server>('/servers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  startDownload: (id: string) =>
    apiRequest<{ success: boolean; message: string }>(`/servers/${id}/download`, {
      method: 'POST',
    }),

  delete: (id: string) =>
    apiRequest<void>(`/servers/${id}`, {
      method: 'DELETE',
    }),

  start: (id: string) =>
    apiRequest<{ success: boolean }>(`/servers/${id}/start`, {
      method: 'POST',
    }),

  stop: (id: string) =>
    apiRequest<{ success: boolean }>(`/servers/${id}/stop`, {
      method: 'POST',
    }),

  restart: (id: string) =>
    apiRequest<{ success: boolean }>(`/servers/${id}/restart`, {
      method: 'POST',
    }),

  getLogs: (id: string) =>
    apiRequest<{ logs: Array<{ line: string; timestamp: string }> }>(`/servers/${id}/logs`),

  getConfig: (id: string) => apiRequest<ConfigResponse>(`/servers/${id}/config`),

  updateConfig: (id: string, config: GameConfig) =>
    apiRequest<ConfigResponse>(`/servers/${id}/config`, {
      method: 'PATCH',
      body: JSON.stringify(config),
    }),
};
