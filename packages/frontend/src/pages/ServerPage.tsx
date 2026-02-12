import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { serversApi } from '@/api/servers';
import { ServerConsole } from '@/components/servers/ServerConsole';
import { ServerAccessManager } from '@/components/servers/ServerAccessManager';
import { ServerConfigEditor } from '@/components/servers/ServerConfigEditor';
import { ServerBackupManager } from '@/components/servers/ServerBackupManager';
import { ServerFileManager } from '@/components/servers/ServerFileManager';
import { ServerScheduleManager } from '@/components/servers/ServerScheduleManager';
import { ServerUpdateManager } from '@/components/servers/ServerUpdateManager';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/common/Button';
import { useSocket } from '@/hooks/useSocket';
import { hasServerPermissionLevel } from '@/hooks/usePermissions';
import type { ServerWithPermissions, ServerStatus } from '@deployy/shared';

type TabType = 'console' | 'files' | 'settings' | 'backups' | 'schedules' | 'updates' | 'access';

export function ServerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [server, setServer] = useState<ServerWithPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('console');
  const [actionLoading, setActionLoading] = useState<'start' | 'stop' | 'restart' | 'delete' | null>(null);
  const socket = useSocket();

  // Permission level helpers
  const userLevel = server?.userPermissionLevel;
  const canOperate = hasServerPermissionLevel(userLevel, 'operator');
  const canManageSettings = hasServerPermissionLevel(userLevel, 'admin');
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
    if (!id || actionLoading) return;
    try {
      setActionLoading('start');
      await serversApi.start(id);
      fetchServer();
    } catch {
      // Error handled by API client (5xx logged, 4xx shown in UI)
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async () => {
    if (!id || actionLoading) return;
    try {
      setActionLoading('stop');
      await serversApi.stop(id);
      fetchServer();
    } catch {
      // Error handled by API client (5xx logged, 4xx shown in UI)
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestart = async () => {
    if (!id || actionLoading) return;
    try {
      setActionLoading('restart');
      await serversApi.restart(id);
      fetchServer();
    } catch {
      // Error handled by API client (5xx logged, 4xx shown in UI)
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!id || actionLoading) return;
    if (!confirm('Are you sure you want to delete this server?')) return;

    try {
      setActionLoading('delete');
      await serversApi.delete(id);
      navigate('/');
    } catch {
      // Error handled by API client (5xx logged, 4xx shown in UI)
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <SpinnerLarge />
        <p className="text-slate-400 mt-4">Loading server...</p>
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
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-2">{server.name}</h1>
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

        <div className="flex flex-wrap gap-2">
          {canOperate && (
            <>
              <Button
                onClick={handleStart}
                variant="primary"
                className="flex-1 sm:flex-none min-w-[80px]"
                disabled={server.status === 'running' || server.status === 'starting' || actionLoading !== null}
              >
                {actionLoading === 'start' ? (
                  <>
                    <Spinner /> Starting...
                  </>
                ) : (
                  'Start'
                )}
              </Button>
              <Button
                onClick={handleStop}
                variant="danger"
                className="flex-1 sm:flex-none min-w-[80px]"
                disabled={server.status !== 'running' || actionLoading !== null}
              >
                {actionLoading === 'stop' ? (
                  <>
                    <Spinner /> Stopping...
                  </>
                ) : (
                  'Stop'
                )}
              </Button>
              <Button
                onClick={handleRestart}
                variant="secondary"
                className="flex-1 sm:flex-none min-w-[80px]"
                disabled={server.status !== 'running' || actionLoading !== null}
              >
                {actionLoading === 'restart' ? (
                  <>
                    <Spinner /> Restarting...
                  </>
                ) : (
                  'Restart'
                )}
              </Button>
            </>
          )}
          {canDelete && (
            <Button
              onClick={handleDelete}
              variant="danger"
              className="w-full sm:w-auto sm:ml-auto min-w-[80px]"
              disabled={actionLoading !== null}
            >
              {actionLoading === 'delete' ? (
                <>
                  <Spinner /> Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-700 mb-6 -mx-4 px-4 overflow-x-auto">
        <nav className="flex gap-1 sm:gap-4 min-w-max">
          <TabButton
            active={activeTab === 'console'}
            onClick={() => setActiveTab('console')}
          >
            Console
          </TabButton>
          {canManageSettings && (
            <TabButton
              active={activeTab === 'files'}
              onClick={() => setActiveTab('files')}
            >
              Files
            </TabButton>
          )}
          {canManageSettings && (
            <TabButton
              active={activeTab === 'settings'}
              onClick={() => setActiveTab('settings')}
            >
              Settings
            </TabButton>
          )}
          {canManageSettings && (
            <TabButton
              active={activeTab === 'backups'}
              onClick={() => setActiveTab('backups')}
            >
              Backups
            </TabButton>
          )}
          {canManageSettings && (
            <TabButton
              active={activeTab === 'schedules'}
              onClick={() => setActiveTab('schedules')}
            >
              Schedules
            </TabButton>
          )}
          {canManageSettings && (
            <TabButton
              active={activeTab === 'updates'}
              onClick={() => setActiveTab('updates')}
            >
              Updates
            </TabButton>
          )}
          {isOwner && (
            <TabButton
              active={activeTab === 'access'}
              onClick={() => setActiveTab('access')}
            >
              Access
            </TabButton>
          )}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'console' && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
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
      )}

      {activeTab === 'files' && canManageSettings && (
        <ServerFileManager serverId={server.id} />
      )}

      {activeTab === 'settings' && canManageSettings && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">Server Settings</h2>
          <ServerConfigEditor serverId={server.id} serverStatus={server.status} />
        </div>
      )}

      {activeTab === 'backups' && canManageSettings && (
        <ServerBackupManager serverId={server.id} serverStatus={server.status} />
      )}

      {activeTab === 'schedules' && canManageSettings && (
        <ServerScheduleManager serverId={server.id} />
      )}

      {activeTab === 'updates' && canManageSettings && (
        <ServerUpdateManager
          serverId={server.id}
          serverStatus={server.status}
          gameType={server.gameType}
        />
      )}

      {activeTab === 'access' && isOwner && (
        <ServerAccessManager serverId={server.id} isOwner={isOwner} />
      )}
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-2 sm:px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        active
          ? 'text-primary-400 border-primary-400'
          : 'text-slate-400 border-transparent hover:text-slate-200 hover:border-slate-600'
      }`}
    >
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function SpinnerLarge() {
  return (
    <svg className="animate-spin h-8 w-8 text-primary-400" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
