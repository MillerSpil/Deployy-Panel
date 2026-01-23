import type { Server } from '@deployy/shared';
import { BaseAdapter } from './BaseAdapter.js';
import { HytaleAdapter } from './HytaleAdapter.js';

export class AdapterFactory {
  static create(server: Server): BaseAdapter {
    switch (server.gameType) {
      case 'hytale':
        return new HytaleAdapter(server);
      case 'minecraft':
        throw new Error('Minecraft adapter not yet implemented');
      default:
        throw new Error(`Unsupported game type: ${server.gameType}`);
    }
  }
}
