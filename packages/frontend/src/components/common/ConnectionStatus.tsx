import { useSocketStatus } from '@/hooks/useSocket';
import { useAuth } from '@/hooks/useAuth';

export function ConnectionStatus() {
  const status = useSocketStatus();
  const { user } = useAuth();

  if (!user || status === 'connected') return null;

  const message =
    status === 'reconnecting'
      ? 'Reconnecting to server...'
      : 'Disconnected from server. Attempting to reconnect...';

  return (
    <div className="bg-amber-600 text-white">
      <div className="container mx-auto px-4 py-2">
        <p className="text-sm text-center font-medium">{message}</p>
      </div>
    </div>
  );
}
