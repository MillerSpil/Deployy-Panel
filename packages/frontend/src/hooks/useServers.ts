import { useState, useEffect } from 'react';
import { serversApi } from '../api/servers';
import { useSocket } from './useSocket';
import type { Server, ServerStatus } from '@deployy/shared';

export function useServers() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const socket = useSocket();

  const fetchServers = async () => {
    try {
      setLoading(true);
      const data = await serversApi.list();
      setServers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch servers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleStatusUpdate = (data: { serverId: string; status: string }) => {
      setServers((prev) =>
        prev.map((server) =>
          server.id === data.serverId
            ? { ...server, status: data.status as ServerStatus }
            : server
        )
      );
    };

    socket.on('server:status', handleStatusUpdate);

    return () => {
      socket.off('server:status', handleStatusUpdate);
    };
  }, [socket]);

  return { servers, loading, error, refetch: fetchServers };
}
