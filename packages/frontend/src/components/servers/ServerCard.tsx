import type { Server } from '@deployy/shared';
import { StatusBadge } from '../common/StatusBadge';
import { Button } from '../common/Button';

interface ServerCardProps {
  server: Server;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onView: (id: string) => void;
}

function getGameTypeDisplay(server: Server): string {
  if (server.gameType === 'minecraft') {
    const flavor = (server.config as Record<string, unknown>)?.flavor as string;
    if (flavor) {
      const flavorName = flavor.charAt(0).toUpperCase() + flavor.slice(1);
      return `Minecraft - ${flavorName}`;
    }
    return 'Minecraft';
  }
  if (server.gameType === 'hytale') {
    return 'Hytale';
  }
  return server.gameType;
}

export function ServerCard({ server, onStart, onStop, onView }: ServerCardProps) {
  const isRunning = server.status === 'running';

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">{server.name}</h3>
          <p className="text-sm text-slate-400">{getGameTypeDisplay(server)}</p>
        </div>
        <StatusBadge status={server.status} />
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Port:</span>
          <span className="font-medium text-slate-200">{server.port}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Max Players:</span>
          <span className="font-medium text-slate-200">{server.maxPlayers}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={() => onView(server.id)} variant="secondary" className="flex-1">
          View
        </Button>
        {isRunning ? (
          <Button onClick={() => onStop(server.id)} variant="danger" className="flex-1">
            Stop
          </Button>
        ) : (
          <Button
            onClick={() => onStart(server.id)}
            variant="primary"
            className="flex-1"
            disabled={server.status === 'starting'}
          >
            {server.status === 'starting' ? 'Starting...' : 'Start'}
          </Button>
        )}
      </div>
    </div>
  );
}
