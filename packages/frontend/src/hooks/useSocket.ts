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

export type SocketStatus = 'connected' | 'disconnected' | 'reconnecting';

export function useSocketStatus(): SocketStatus {
  const { user } = useAuth();
  const [status, setStatus] = useState<SocketStatus>(
    globalSocket?.connected ? 'connected' : 'disconnected'
  );

  useEffect(() => {
    if (!user || !globalSocket) {
      setStatus('disconnected');
      return;
    }

    const socket = globalSocket;

    const onConnect = () => setStatus('connected');
    const onDisconnect = () => setStatus('disconnected');
    const onReconnectAttempt = () => setStatus('reconnecting');

    // Set initial status
    setStatus(socket.connected ? 'connected' : 'disconnected');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.io.on('reconnect', onConnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.io.off('reconnect', onConnect);
    };
  }, [user]);

  return status;
}
