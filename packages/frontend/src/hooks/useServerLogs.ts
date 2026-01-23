import { useState, useEffect } from 'react';
import { useSocket } from './useSocket';
import { serversApi } from '../api/servers';

interface LogEntry {
  line: string;
  timestamp: string;
}

const MAX_LOGS = 1000;

export function useServerLogs(serverId: string | null) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const socket = useSocket();

  useEffect(() => {
    if (!serverId) {
      setLogs([]);
      setLoaded(false);
      return;
    }

    setLoaded(false);
    serversApi
      .getLogs(serverId)
      .then((data) => {
        setLogs(data.logs || []);
        setLoaded(true);
      })
      .catch(() => {
        setLogs([]);
        setLoaded(true);
      });
  }, [serverId]);

  useEffect(() => {
    if (!socket || !serverId || !loaded) return;

    const handleLog = (data: { serverId: string; line: string; timestamp: string }) => {
      if (data.serverId === serverId) {
        const newEntry = { line: data.line, timestamp: data.timestamp };
        setLogs((currentLogs) => [...currentLogs, newEntry].slice(-MAX_LOGS));
      }
    };

    socket.on('server:log', handleLog);

    return () => {
      socket.off('server:log', handleLog);
    };
  }, [socket, serverId, loaded]);

  return logs;
}
