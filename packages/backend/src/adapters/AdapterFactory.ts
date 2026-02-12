import type { Server } from '@deployy/shared';
import { BaseAdapter } from './BaseAdapter.js';
import { HytaleAdapter } from './HytaleAdapter.js';
import { MinecraftAdapter } from './MinecraftAdapter.js';

export class AdapterFactory {
  static create(server: Server): BaseAdapter {
    switch (server.gameType) {
      case 'hytale':
        return new HytaleAdapter(server);
      case 'minecraft':
        return new MinecraftAdapter(server);
      default:
        throw new Error(`Unsupported game type: ${server.gameType}`);
    }
  }
}
