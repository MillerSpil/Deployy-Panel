import { apiRequest } from './client';
import type { UpdateInfo, PanelSettings, UpdateBackupInfo } from '@deployy/shared';

export const updateApi = {
  // Check for updates (fetches from GitHub)
  checkForUpdates: () => apiRequest<UpdateInfo>('/update/status'),

  // Get current version only (no GitHub check)
  getVersion: () => apiRequest<{ version: string }>('/update/version'),

  // Get panel settings
  getSettings: () => apiRequest<PanelSettings>('/update/settings'),

  // Update panel settings
  updateSettings: (settings: Partial<PanelSettings>) =>
    apiRequest<PanelSettings>('/update/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings),
    }),

  // Start update process
  applyUpdate: (downloadUrl: string, targetVersion: string) =>
    apiRequest<{ success: boolean; message: string }>('/update/apply', {
      method: 'POST',
      body: JSON.stringify({ downloadUrl, targetVersion }),
    }),

  // List update backups
  listBackups: () => apiRequest<UpdateBackupInfo[]>('/update/backups'),

  // Delete a backup
  deleteBackup: (backupId: string) =>
    apiRequest<void>(`/update/backups/${backupId}`, {
      method: 'DELETE',
    }),

  // Rollback to a backup
  rollback: (backupId: string) =>
    apiRequest<{ success: boolean; message: string }>(`/update/rollback/${backupId}`, {
      method: 'POST',
    }),
};
