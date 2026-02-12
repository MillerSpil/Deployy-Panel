import { logger } from '../utils/logger.js';
import { fetchWithTimeout } from '../adapters/BaseAdapter.js';
import type { MinecraftFlavor } from '@deployy/shared';

export interface MinecraftVersion {
  id: string;
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha';
  releaseTime: string;
}

export interface PaperVersion {
  version: string;
  builds: number[];
}

// Cache duration: 10 minutes
const CACHE_DURATION = 10 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class MinecraftVersionService {
  private vanillaCache: CacheEntry<MinecraftVersion[]> | null = null;
  private paperCache: CacheEntry<PaperVersion[]> | null = null;

  /**
   * Get available Vanilla Minecraft versions from Mojang.
   * Returns only release versions by default, sorted newest first.
   */
  async getVanillaVersions(includeSnapshots: boolean = false): Promise<MinecraftVersion[]> {
    // Check cache
    if (this.vanillaCache && Date.now() - this.vanillaCache.timestamp < CACHE_DURATION) {
      const cached = this.vanillaCache.data;
      return includeSnapshots ? cached : cached.filter((v) => v.type === 'release');
    }

    try {
      const response = await fetchWithTimeout('https://launchermeta.mojang.com/mc/game/version_manifest.json');
      if (!response.ok) {
        throw new Error(`Failed to fetch version manifest: ${response.status}`);
      }

      const manifest = (await response.json()) as {
        latest: { release: string; snapshot: string };
        versions: { id: string; type: string; releaseTime: string; url: string }[];
      };

      const versions: MinecraftVersion[] = manifest.versions.map((v) => ({
        id: v.id,
        type: v.type as MinecraftVersion['type'],
        releaseTime: v.releaseTime,
      }));

      // Update cache
      this.vanillaCache = { data: versions, timestamp: Date.now() };

      logger.info(`Fetched ${versions.length} Vanilla Minecraft versions`);

      return includeSnapshots ? versions : versions.filter((v) => v.type === 'release');
    } catch (error) {
      logger.error('Failed to fetch Vanilla versions', { error });
      throw error;
    }
  }

  /**
   * Get available Paper versions from PaperMC API.
   * Fetches build info in parallel instead of sequentially.
   */
  async getPaperVersions(): Promise<PaperVersion[]> {
    // Check cache
    if (this.paperCache && Date.now() - this.paperCache.timestamp < CACHE_DURATION) {
      return this.paperCache.data;
    }

    try {
      const response = await fetchWithTimeout('https://api.papermc.io/v2/projects/paper');
      if (!response.ok) {
        throw new Error(`Failed to fetch Paper versions: ${response.status}`);
      }

      const data = (await response.json()) as { versions: string[] };

      // Only fetch details for recent versions to keep it manageable
      const recentVersions = data.versions.slice(-20).reverse();

      // Fetch all build info in parallel instead of sequentially
      const versionPromises = recentVersions.map(async (version): Promise<PaperVersion> => {
        try {
          const buildsResponse = await fetchWithTimeout(
            `https://api.papermc.io/v2/projects/paper/versions/${version}`
          );
          if (buildsResponse.ok) {
            const buildsData = (await buildsResponse.json()) as { builds: number[] };
            return { version, builds: buildsData.builds };
          }
          return { version, builds: [] };
        } catch {
          return { version, builds: [] };
        }
      });

      const versions = await Promise.all(versionPromises);

      // Update cache
      this.paperCache = { data: versions, timestamp: Date.now() };

      logger.info(`Fetched ${versions.length} Paper versions`);

      return versions;
    } catch (error) {
      logger.error('Failed to fetch Paper versions', { error });
      throw error;
    }
  }

  /**
   * Get the latest version for a given flavor.
   */
  async getLatestVersion(flavor: MinecraftFlavor): Promise<string> {
    if (flavor === 'paper') {
      const versions = await this.getPaperVersions();
      return versions[0]?.version || '1.21.4';
    }

    const versions = await this.getVanillaVersions();
    return versions[0]?.id || '1.21.4';
  }
}
