import { useState, useEffect, useRef } from 'react';
import { serversApi } from '@/api/servers';
import { useSocket } from '@/hooks/useSocket';
import { Button } from '@/components/common/Button';
import type { HytaleDownloadStatus, ServerStatus } from '@deployy/shared';

interface ServerUpdateManagerProps {
  serverId: string;
  serverStatus: ServerStatus;
}

export function ServerUpdateManager({
  serverId,
  serverStatus,
}: ServerUpdateManagerProps) {
  const socket = useSocket();
  const [isUpdating, setIsUpdating] = useState(false);
  const [status, setStatus] = useState<HytaleDownloadStatus | null>(null);
  const [message, setMessage] = useState('');
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<Array<{ line: string; timestamp: string }>>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const isServerRunning = serverStatus === 'running' || serverStatus === 'starting';

  // Scroll to bottom when logs update
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Listen for download WebSocket events
  useEffect(() => {
    if (!socket) return;

    const handleProgress = (data: {
      serverId: string;
      status: HytaleDownloadStatus;
      message: string;
      authUrl?: string;
    }) => {
      if (data.serverId !== serverId) return;

      setStatus(data.status);
      setMessage(data.message);

      if (data.authUrl) {
        setAuthUrl(data.authUrl);
      }

      if (data.status === 'completed' || data.status === 'error') {
        setIsUpdating(false);
        if (data.status === 'completed') {
          setAuthUrl(null);
        }
      }
    };

    const handleLog = (data: { serverId: string; line: string; timestamp: string }) => {
      if (data.serverId !== serverId) return;
      setLogs((prev) => [...prev.slice(-99), { line: data.line, timestamp: data.timestamp }]);
    };

    socket.on('hytale:download:progress', handleProgress);
    socket.on('hytale:download:log', handleLog);

    return () => {
      socket.off('hytale:download:progress', handleProgress);
      socket.off('hytale:download:log', handleLog);
    };
  }, [socket, serverId]);

  const handleUpdate = async () => {
    if (isServerRunning) {
      alert('Please stop the server before updating.');
      return;
    }

    setIsUpdating(true);
    setLogs([]);
    setStatus(null);
    setMessage('');
    setAuthUrl(null);

    try {
      await serversApi.startDownload(serverId);
    } catch (err) {
      setIsUpdating(false);
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Failed to start update');
    }
  };

  const handleOpenAuth = () => {
    if (authUrl) {
      window.open(authUrl, '_blank');
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <h2 className="text-xl font-semibold text-slate-100 mb-4">Server Updates</h2>

      <p className="text-slate-400 mb-6">
        Download the latest server files from Hytale. This will replace your current server files.
      </p>

      {/* Status Message */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg ${
            status === 'error'
              ? 'bg-red-900/30 border border-red-700 text-red-300'
              : status === 'completed'
              ? 'bg-green-900/30 border border-green-700 text-green-300'
              : 'bg-slate-700 text-slate-300'
          }`}
        >
          {message}
        </div>
      )}

      {/* Auth Button */}
      {authUrl && (
        <div className="mb-4 p-4 bg-yellow-900/30 border border-yellow-700 rounded-lg">
          <p className="text-yellow-300 mb-3">
            Please authenticate with your Hytale account to download server files.
          </p>
          <Button onClick={handleOpenAuth} variant="primary">
            Authenticate with Hytale
          </Button>
        </div>
      )}

      {/* Warning if server is running */}
      {isServerRunning && (
        <div className="mb-4 p-3 rounded-lg bg-yellow-900/30 border border-yellow-700 text-yellow-300 text-sm">
          The server must be stopped before updating. Please stop the server first.
        </div>
      )}

      {/* Update Button */}
      <div className="mb-6">
        <Button
          onClick={handleUpdate}
          disabled={isUpdating || isServerRunning}
          variant="primary"
          title={isServerRunning ? 'Stop the server before updating' : undefined}
        >
          {isUpdating ? (
            <>
              <Spinner />
              Updating...
            </>
          ) : (
            'Update Server'
          )}
        </Button>
      </div>

      {/* Console Output */}
      {logs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-400 mb-2">Console Output</h3>
          <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm max-h-64 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className="text-slate-300 whitespace-pre-wrap break-all">
                <span className="text-slate-500 text-xs mr-2">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                {log.line}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
