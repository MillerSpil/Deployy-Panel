import { apiRequest } from './client';
import type { Backup } from '@deployy/shared';

export interface BackupsResponse {
  backups: Backup[];
  retention: number;
  backupPath: string;
}

export interface BackupWithSkipped extends Backup {
  skippedFiles?: string[];
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const backupsApi = {
  list: (serverId: string) =>
    apiRequest<BackupsResponse>(`/servers/${serverId}/backups`),

  create: (serverId: string, name?: string) =>
    apiRequest<BackupWithSkipped>(`/servers/${serverId}/backups`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  restore: (serverId: string, backupId: string) =>
    apiRequest<{ success: boolean }>(`/servers/${serverId}/backups/${backupId}/restore`, {
      method: 'POST',
    }),

  delete: (serverId: string, backupId: string) =>
    apiRequest<void>(`/servers/${serverId}/backups/${backupId}`, {
      method: 'DELETE',
    }),

  updateRetention: (serverId: string, backupRetention: number) =>
    apiRequest<{ success: boolean; backupRetention: number }>(
      `/servers/${serverId}/backups/retention`,
      {
        method: 'PATCH',
        body: JSON.stringify({ backupRetention }),
      }
    ),

  updateBackupPath: (serverId: string, backupPath: string) =>
    apiRequest<{ success: boolean; backupPath: string }>(
      `/servers/${serverId}/backups/path`,
      {
        method: 'PATCH',
        body: JSON.stringify({ backupPath }),
      }
    ),

  getDownloadUrl: (serverId: string, backupId: string) =>
    `${API_BASE_URL}/servers/${serverId}/backups/${backupId}/download`,
};
