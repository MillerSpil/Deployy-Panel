import { apiRequest } from './client';
import type { FileInfo, FileContent } from '@deployy/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface ListFilesResponse {
  files: FileInfo[];
  path: string;
}

export const filesApi = {
  list: (serverId: string, path: string = '') =>
    apiRequest<ListFilesResponse>(`/servers/${serverId}/files?path=${encodeURIComponent(path)}`),

  read: (serverId: string, filePath: string) =>
    apiRequest<FileContent>(`/servers/${serverId}/files/read?path=${encodeURIComponent(filePath)}`),

  write: (serverId: string, filePath: string, content: string) =>
    apiRequest<{ success: boolean }>(`/servers/${serverId}/files/write`, {
      method: 'PUT',
      body: JSON.stringify({ path: filePath, content }),
    }),

  create: (serverId: string, filePath: string, type: 'file' | 'directory') =>
    apiRequest<FileInfo>(`/servers/${serverId}/files/create`, {
      method: 'POST',
      body: JSON.stringify({ path: filePath, type }),
    }),

  delete: (serverId: string, filePath: string) =>
    apiRequest<void>(`/servers/${serverId}/files/delete`, {
      method: 'DELETE',
      body: JSON.stringify({ path: filePath }),
    }),

  rename: (serverId: string, oldPath: string, newName: string) =>
    apiRequest<FileInfo>(`/servers/${serverId}/files/rename`, {
      method: 'PATCH',
      body: JSON.stringify({ oldPath, newName }),
    }),

  getDownloadUrl: (serverId: string, filePath: string) =>
    `${API_BASE_URL}/servers/${serverId}/files/download?path=${encodeURIComponent(filePath)}`,

  upload: async (serverId: string, targetPath: string, file: File): Promise<FileInfo> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetPath', targetPath);

    const response = await fetch(`${API_BASE_URL}/servers/${serverId}/files/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Upload failed');
    }

    return response.json();
  },
};
