import { apiRequest } from './client';
import type { Server } from '@deployy/shared';

export const serversApi = {
  list: () => apiRequest<Server[]>('/servers'),

  get: (id: string) => apiRequest<Server>(`/servers/${id}`),

  create: (data: { name: string; gameType: string; port: number; maxPlayers: number }) =>
    apiRequest<Server>('/servers', {
      method: 'POST',
      body: JSON.stringify(data),
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
};
