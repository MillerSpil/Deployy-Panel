import type { ServerStatus } from '@deployy/shared';

interface StatusBadgeProps {
  status: ServerStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const statusClasses: Record<ServerStatus, string> = {
    stopped: 'bg-gray-200 text-gray-800',
    starting: 'bg-yellow-200 text-yellow-800',
    running: 'bg-green-200 text-green-800',
    stopping: 'bg-orange-200 text-orange-800',
    crashed: 'bg-red-200 text-red-800',
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-sm font-medium ${statusClasses[status] || 'bg-gray-200 text-gray-800'}`}
    >
      {status}
    </span>
  );
}
