import path from 'node:path';
import { access } from 'node:fs/promises';

export class PathValidator {
  constructor(private basePath: string) {}

  validate(userPath: string): string {
    const resolved = path.resolve(this.basePath, userPath);
    const baseResolved = path.resolve(this.basePath);

    if (!resolved.startsWith(baseResolved)) {
      throw new Error('Path traversal detected');
    }

    return resolved;
  }

  getServerPath(serverId: string): string {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(serverId)) {
      throw new Error('Invalid server ID format');
    }

    return path.join(this.basePath, serverId);
  }

  async exists(filepath: string): Promise<boolean> {
    try {
      await access(filepath);
      return true;
    } catch {
      return false;
    }
  }
}
