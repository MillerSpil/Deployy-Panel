import type { Server } from '@deployy/shared';
import { ServerCard } from './ServerCard';

interface ServerListProps {
  servers: Server[];
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onView: (id: string) => void;
}

export function ServerList({ servers, onStart, onStop, onView }: ServerListProps) {
  if (servers.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">No servers yet. Create your first server to get started!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {servers.map((server) => (
        <ServerCard
          key={server.id}
          server={server}
          onStart={onStart}
          onStop={onStop}
          onView={onView}
        />
      ))}
    </div>
  );
}
