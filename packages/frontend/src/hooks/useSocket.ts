import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@deployy/shared';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

let globalSocket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function useSocket() {
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(
    globalSocket
  );

  useEffect(() => {
    if (!globalSocket) {
      globalSocket = io(SOCKET_URL);
    }
    setSocket(globalSocket);

    return () => {};
  }, []);

  return socket;
}
