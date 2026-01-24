import { apiRequest } from './client';
import type { ServerAccess, ServerPermissionLevel } from '@deployy/shared';

export const serverAccessApi = {
  list: (serverId: string) => apiRequest<ServerAccess[]>(`/servers/${serverId}/access`),

  grant: (serverId: string, data: { userId: string; permissionLevel: ServerPermissionLevel }) =>
    apiRequest<ServerAccess>(`/servers/${serverId}/access`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (serverId: string, accessId: string, permissionLevel: ServerPermissionLevel) =>
    apiRequest<ServerAccess>(`/servers/${serverId}/access/${accessId}`, {
      method: 'PATCH',
      body: JSON.stringify({ permissionLevel }),
    }),

  revoke: (serverId: string, accessId: string) =>
    apiRequest<void>(`/servers/${serverId}/access/${accessId}`, {
      method: 'DELETE',
    }),

  transferOwnership: (serverId: string, newOwnerId: string) =>
    apiRequest<{ success: boolean }>(`/servers/${serverId}/access/transfer-ownership`, {
      method: 'POST',
      body: JSON.stringify({ newOwnerId }),
    }),
};
