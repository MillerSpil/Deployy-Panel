import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@deployy/shared';
import { useAuth } from './useAuth';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;

let globalSocket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function useSocket() {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(
    globalSocket
  );

  useEffect(() => {
    // Only connect when user is authenticated
    if (!user) {
      if (globalSocket) {
        globalSocket.disconnect();
        globalSocket = null;
        setSocket(null);
      }
      return;
    }

    if (!globalSocket) {
      globalSocket = io(SOCKET_URL ?? window.location.origin, {
        withCredentials: true,
      });
    }
    setSocket(globalSocket);

    return () => {};
  }, [user]);

  return socket;
}
