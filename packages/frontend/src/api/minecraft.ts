import { apiRequest } from './client';

export interface MinecraftVersion {
  id: string;
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha';
  releaseTime: string;
}

export interface PaperVersion {
  version: string;
  builds: number[];
}

export const minecraftApi = {
  getVanillaVersions: (includeSnapshots: boolean = false) =>
    apiRequest<{ versions: MinecraftVersion[] }>(
      `/minecraft/versions/vanilla${includeSnapshots ? '?snapshots=true' : ''}`
    ),

  getPaperVersions: () =>
    apiRequest<{ versions: PaperVersion[] }>('/minecraft/versions/paper'),

  getLatestVersion: (flavor: 'vanilla' | 'paper') =>
    apiRequest<{ version: string }>(`/minecraft/versions/latest/${flavor}`),
};
