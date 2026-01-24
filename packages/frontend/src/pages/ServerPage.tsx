import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { serversApi } from '@/api/servers';
import { ServerConsole } from '@/components/servers/ServerConsole';
import { ServerAccessManager } from '@/components/servers/ServerAccessManager';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/common/Button';
import { useSocket } from '@/hooks/useSocket';
import { hasServerPermissionLevel } from '@/hooks/usePermissions';
import type { ServerWithPermissions, ServerStatus } from '@deployy/shared';

export function ServerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [server, setServer] = useState<ServerWithPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const socket = useSocket();

  // Permission level helpers
  const userLevel = server?.userPermissionLevel;
  const canOperate = hasServerPermissionLevel(userLevel, 'operator');
  const canDelete = hasServerPermissionLevel(userLevel, 'owner');
  const isOwner = userLevel === 'owner';

  const fetchServer = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const data = await serversApi.get(id);
      setServer(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServer();
  }, [id]);

  useEffect(() => {
    if (!socket || !id) return;

    const handleStatusUpdate = (data: { serverId: string; status: string }) => {
      if (data.serverId === id) {
        setServer((prev) => (prev ? { ...prev, status: data.status as ServerStatus } : prev));
      }
    };

    socket.on('server:status', handleStatusUpdate);

    return () => {
      socket.off('server:status', handleStatusUpdate);
    };
  }, [socket, id]);

  const handleStart = async () => {
    if (!id) return;
    try {
      await serversApi.start(id);
      fetchServer();
    } catch (err) {
      console.error('Failed to start server:', err);
    }
  };

  const handleStop = async () => {
    if (!id) return;
    try {
      await serversApi.stop(id);
      fetchServer();
    } catch (err) {
      console.error('Failed to stop server:', err);
    }
  };

  const handleRestart = async () => {
    if (!id) return;
    try {
      await serversApi.restart(id);
      fetchServer();
    } catch (err) {
      console.error('Failed to restart server:', err);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm('Are you sure you want to delete this server?')) return;

    try {
      await serversApi.delete(id);
      navigate('/');
    } catch (err) {
      console.error('Failed to delete server:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-slate-400">Loading server...</p>
      </div>
    );
  }

  if (error || !server) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <p className="text-red-400 mb-4">Error: {error || 'Server not found'}</p>
          <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Button onClick={() => navigate('/')} variant="secondary" className="mb-4">
        &larr; Back
      </Button>

      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 mb-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-100 mb-2">{server.name}</h1>
            <p className="text-slate-400">{server.gameType}</p>
          </div>
          <StatusBadge status={server.status} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div>
            <p className="text-sm text-slate-400">Port</p>
            <p className="text-lg font-semibold text-slate-200">{server.port}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Max Players</p>
            <p className="text-lg font-semibold text-slate-200">{server.maxPlayers}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Version</p>
            <p className="text-lg font-semibold text-slate-200">{server.version || 'Unknown'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Created</p>
            <p className="text-lg font-semibold text-slate-200">
              {new Date(server.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex gap-2 h-10">
          {canOperate && (
            <>
              <Button
                onClick={handleStart}
                variant="primary"
                disabled={server.status === 'running' || server.status === 'starting'}
                className={server.status === 'running' || server.status === 'starting' ? 'opacity-50 cursor-not-allowed' : ''}
              >
                Start
              </Button>
              <Button
                onClick={handleStop}
                variant="danger"
                disabled={server.status !== 'running'}
                className={server.status !== 'running' ? 'opacity-50 cursor-not-allowed' : ''}
              >
                Stop
              </Button>
              <Button
                onClick={handleRestart}
                variant="secondary"
                disabled={server.status !== 'running'}
                className={server.status !== 'running' ? 'opacity-50 cursor-not-allowed' : ''}
              >
                Restart
              </Button>
            </>
          )}
          {canDelete && (
            <Button onClick={handleDelete} variant="danger" className="ml-auto">
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 mb-6">
        <h2 className="text-xl font-semibold text-slate-100 mb-4">Console</h2>
        {server.status === 'stopped' ? (
          <div className="bg-slate-900 rounded-lg p-8 text-center">
            <p className="text-slate-500">Start the server to view console output</p>
          </div>
        ) : (
          <ServerConsole
            serverId={server.id}
            canSendCommands={server.status === 'running' && canOperate}
          />
        )}
      </div>

      {isOwner && <ServerAccessManager serverId={server.id} isOwner={isOwner} />}
    </div>
  );
}
