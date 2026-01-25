import { useState, useEffect, useRef } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useSocket } from '@/hooks/useSocket';
import type { HytaleDownloadStatus } from '@deployy/shared';

interface HytaleDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverId: string;
  serverName: string;
  startDownload: () => Promise<unknown>;
}

interface LogEntry {
  line: string;
  timestamp: string;
}

const STATUS_MESSAGES: Record<HytaleDownloadStatus, string> = {
  downloading_tool: 'Downloading Hytale downloader tool...',
  extracting_tool: 'Extracting downloader tool...',
  waiting_auth: 'Waiting for authentication...',
  downloading_server: 'Downloading server files...',
  extracting_server: 'Extracting server files...',
  cleanup: 'Cleaning up temporary files...',
  completed: 'Download completed successfully!',
  error: 'Download failed',
};

export function HytaleDownloadModal({ isOpen, onClose, serverId, serverName, startDownload }: HytaleDownloadModalProps) {
  const socket = useSocket();
  const [status, setStatus] = useState<HytaleDownloadStatus>('downloading_tool');
  const [message, setMessage] = useState('Starting download...');
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const isComplete = status === 'completed';
  const isError = status === 'error';
  const canClose = isComplete || isError;

  // Subscribe to events first
  useEffect(() => {
    if (!socket || !isOpen) return;

    const handleProgress = (data: { serverId: string; status: HytaleDownloadStatus; message: string; authUrl?: string }) => {
      if (data.serverId !== serverId) return;

      setStatus(data.status);
      setMessage(data.message);
      if (data.authUrl) {
        setAuthUrl(data.authUrl);
      }
    };

    const handleLog = (data: { serverId: string; line: string; timestamp: string }) => {
      if (data.serverId !== serverId) return;

      setLogs(prev => [...prev, { line: data.line, timestamp: data.timestamp }]);
    };

    socket.on('hytale:download:progress', handleProgress);
    socket.on('hytale:download:log', handleLog);

    return () => {
      socket.off('hytale:download:progress', handleProgress);
      socket.off('hytale:download:log', handleLog);
    };
  }, [socket, isOpen, serverId]);

  // Start download after socket is ready and subscribed
  useEffect(() => {
    if (!socket || !isOpen || downloadStarted) return;

    // Small delay to ensure event handlers are registered
    const timer = setTimeout(() => {
      setDownloadStarted(true);
      startDownload().catch((err: Error) => {
        setStatus('error');
        setMessage(err.message || 'Failed to start download');
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [socket, isOpen, downloadStarted, startDownload]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleAuthenticate = () => {
    if (authUrl) {
      window.open(authUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const getStatusIcon = () => {
    if (isComplete) {
      return (
        <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    }
    if (isError) {
      return (
        <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    }
    return (
      <svg className="w-6 h-6 text-primary-400 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={canClose ? onClose : () => {}}
      title={`Downloading Server Files - ${serverName}`}
    >
      <div className="space-y-4">
        {/* Status */}
        <div className="flex items-center gap-3 p-4 bg-slate-700/50 rounded-lg">
          {getStatusIcon()}
          <div>
            <p className="font-medium text-slate-100">{STATUS_MESSAGES[status]}</p>
            <p className="text-sm text-slate-400">{message}</p>
          </div>
        </div>

        {/* Auth Button */}
        {status === 'waiting_auth' && authUrl && (
          <div className="p-4 bg-primary-900/30 border border-primary-700 rounded-lg">
            <p className="text-sm text-slate-300 mb-3">
              You need to authenticate with your Hytale account to download the server files.
              Click the button below to open the authentication page in your browser.
            </p>
            <Button
              variant="primary"
              onClick={handleAuthenticate}
              className="w-full"
            >
              Open Authentication Page
            </Button>
          </div>
        )}

        {/* Console Output */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-300">Console Output</h4>
          <div className="h-48 overflow-y-auto bg-slate-900 rounded-lg p-3 font-mono text-xs text-slate-300">
            {logs.length === 0 ? (
              <p className="text-slate-500 italic">Waiting for output...</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="py-0.5">
                  <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                  {log.line}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>

        {/* Close Button */}
        {canClose && (
          <Button
            variant={isComplete ? 'primary' : 'secondary'}
            onClick={onClose}
            className="w-full"
          >
            {isComplete ? 'Done' : 'Close'}
          </Button>
        )}

        {/* Cannot close warning */}
        {!canClose && (
          <p className="text-xs text-slate-500 text-center">
            Please wait for the download to complete. Do not close this window.
          </p>
        )}
      </div>
    </Modal>
  );
}
