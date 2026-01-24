import { useState, useEffect } from 'react';
import { backupsApi } from '@/api/backups';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import type { Backup, ServerStatus } from '@deployy/shared';

interface ServerBackupManagerProps {
  serverId: string;
  serverStatus: ServerStatus;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleString();
}

export function ServerBackupManager({ serverId, serverStatus }: ServerBackupManagerProps) {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [retention, setRetention] = useState(5);
  const [backupPath, setBackupPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [restoring, setRestoring] = useState<Backup | null>(null);
  const [deleting, setDeleting] = useState<Backup | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [restoringInProgress, setRestoringInProgress] = useState(false);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const data = await backupsApi.list(serverId);
      setBackups(data.backups);
      setRetention(data.retention);
      setBackupPath(data.backupPath);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch backups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, [serverId]);

  const handleCreate = async (name?: string) => {
    try {
      setCreating(true);
      setError(null);
      setSuccess(null);

      await backupsApi.create(serverId, name);
      setIsCreateModalOpen(false);
      setSuccess('Backup created successfully');
      await fetchBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create backup');
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async () => {
    if (!restoring) return;
    try {
      setRestoringInProgress(true);
      setError(null);
      await backupsApi.restore(serverId, restoring.id);
      setRestoring(null);
      setSuccess('Backup restored successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore backup');
    } finally {
      setRestoringInProgress(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      setDeletingInProgress(true);
      setError(null);
      await backupsApi.delete(serverId, deleting.id);
      setDeleting(null);
      setSuccess('Backup deleted');
      await fetchBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete backup');
    } finally {
      setDeletingInProgress(false);
    }
  };

  const handleDownload = (backup: Backup) => {
    window.open(backupsApi.getDownloadUrl(serverId, backup.id), '_blank');
  };

  const dismissMessages = () => {
    setError(null);
    setSuccess(null);
  };

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <p className="text-slate-400">Loading backups...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Backups</h2>
          <div className="text-sm text-slate-400 mt-1 space-y-0.5">
            <p>
              Retention: {retention === 0 ? 'Keep all' : `Keep last ${retention}`}
            </p>
            <p className="truncate max-w-md" title={backupPath}>
              Location: <span className="text-slate-500">{backupPath}</span>
            </p>
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="text-primary-400 hover:text-primary-300"
            >
              Edit settings
            </button>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            disabled={creating || serverStatus === 'running'}
            className="min-w-[140px]"
          >
            {creating ? (
              <>
                <Spinner /> Creating...
              </>
            ) : (
              'Create Backup'
            )}
          </Button>
          {serverStatus === 'running' && (
            <p className="text-amber-400 text-xs">Stop server to create backup</p>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-3 mb-4 flex justify-between items-start">
          <p className="text-red-400">{error}</p>
          <button onClick={dismissMessages} className="text-red-400 hover:text-red-300 ml-2">
            <CloseIcon />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-900/50 border border-green-500 rounded-lg p-3 mb-4 flex justify-between items-start">
          <p className="text-green-400">{success}</p>
          <button onClick={dismissMessages} className="text-green-400 hover:text-green-300 ml-2">
            <CloseIcon />
          </button>
        </div>
      )}


      {backups.length === 0 ? (
        <div className="bg-slate-700/50 rounded-lg p-8 text-center">
          <p className="text-slate-400">No backups yet. Create your first backup to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {backups.map((backup) => (
            <div
              key={backup.id}
              className="flex items-center justify-between bg-slate-700 rounded-lg p-4"
            >
              <div className="flex-1 min-w-0">
                <p className="text-slate-100 font-medium truncate">{backup.name}</p>
                <p className="text-sm text-slate-400">
                  {formatBytes(backup.size)} - {formatDate(backup.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Button
                  variant="secondary"
                  onClick={() => handleDownload(backup)}
                  title="Download backup"
                >
                  <DownloadIcon />
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setRestoring(backup)}
                  disabled={serverStatus === 'running'}
                  title={serverStatus === 'running' ? 'Stop server first' : 'Restore backup'}
                >
                  <RestoreIcon />
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setDeleting(backup)}
                  title="Delete backup"
                >
                  <DeleteIcon />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {serverStatus === 'running' && backups.length > 0 && (
        <p className="text-slate-500 text-sm mt-4">
          Note: Stop the server before restoring a backup.
        </p>
      )}

      <CreateBackupModal
        isOpen={isCreateModalOpen}
        onClose={() => !creating && setIsCreateModalOpen(false)}
        onSubmit={handleCreate}
        creating={creating}
      />

      <BackupSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        currentRetention={retention}
        currentBackupPath={backupPath}
        serverId={serverId}
        onSaved={(newRetention, newPath) => {
          setRetention(newRetention);
          setBackupPath(newPath);
          fetchBackups();
        }}
      />

      <Modal
        isOpen={!!restoring}
        onClose={() => !restoringInProgress && setRestoring(null)}
        title="Restore Backup"
      >
        {restoringInProgress ? (
          <div className="py-8 text-center">
            <div className="flex justify-center mb-4">
              <SpinnerLarge />
            </div>
            <p className="text-slate-300">Restoring backup...</p>
            <p className="text-slate-500 text-sm mt-2">This may take a moment</p>
          </div>
        ) : (
          <>
            <p className="text-slate-300 mb-4">
              Are you sure you want to restore <strong>{restoring?.name}</strong>?
              This will replace all current server files with the backup contents.
            </p>
            <div className="bg-amber-900/50 border border-amber-500 rounded-lg p-3 mb-4">
              <p className="text-amber-300 text-sm">
                Warning: This action cannot be undone. Consider creating a backup first.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setRestoring(null)} className="flex-1">
                Cancel
              </Button>
              <Button variant="danger" onClick={handleRestore} className="flex-1">
                Restore
              </Button>
            </div>
          </>
        )}
      </Modal>

      <Modal
        isOpen={!!deleting}
        onClose={() => !deletingInProgress && setDeleting(null)}
        title="Delete Backup"
      >
        {deletingInProgress ? (
          <div className="py-8 text-center">
            <div className="flex justify-center mb-4">
              <SpinnerLarge />
            </div>
            <p className="text-slate-300">Deleting backup...</p>
          </div>
        ) : (
          <>
            <p className="text-slate-300 mb-4">
              Are you sure you want to delete <strong>{deleting?.name}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setDeleting(null)} className="flex-1">
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete} className="flex-1">
                Delete
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

interface CreateBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name?: string) => void;
  creating: boolean;
}

function CreateBackupModal({ isOpen, onClose, onSubmit, creating }: CreateBackupModalProps) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(name || undefined);
    setName('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Backup">
      {creating ? (
        <div className="py-8 text-center">
          <div className="flex justify-center mb-4">
            <SpinnerLarge />
          </div>
          <p className="text-slate-300">Creating backup...</p>
          <p className="text-slate-500 text-sm mt-2">This may take a moment depending on server size</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Backup Name (optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Before mod update"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500"
              maxLength={100}
            />
            <p className="text-slate-500 text-sm mt-1">
              Leave empty for automatic timestamp name.
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Create Backup
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

interface BackupSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRetention: number;
  currentBackupPath: string;
  serverId: string;
  onSaved: (retention: number, backupPath: string) => void;
}

function BackupSettingsModal({
  isOpen,
  onClose,
  currentRetention,
  currentBackupPath,
  serverId,
  onSaved
}: BackupSettingsModalProps) {
  const [retention, setRetention] = useState(currentRetention);
  const [backupPath, setBackupPath] = useState(currentBackupPath);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRetention(currentRetention);
    setBackupPath(currentBackupPath);
  }, [currentRetention, currentBackupPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Update retention
      await backupsApi.updateRetention(serverId, retention);

      // Update backup path if changed
      if (backupPath !== currentBackupPath) {
        const result = await backupsApi.updateBackupPath(serverId, backupPath);
        onSaved(retention, result.backupPath);
      } else {
        onSaved(retention, backupPath);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Backup Settings">
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Retention (Keep Last N Backups)
          </label>
          <input
            type="number"
            value={retention}
            onChange={(e) => setRetention(Math.max(0, parseInt(e.target.value) || 0))}
            min={0}
            max={100}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100"
          />
          <p className="text-slate-500 text-sm mt-1">
            Set to 0 to keep all backups.
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Backup Location
          </label>
          <input
            type="text"
            value={backupPath}
            onChange={(e) => setBackupPath(e.target.value)}
            placeholder="e.g., D:\Backups\MyServer"
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 font-mono text-sm"
          />
          <p className="text-slate-500 text-sm mt-1">
            Custom path for storing backups. Leave as default to store in server folder.
          </p>
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={saving} className="flex-1">
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
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
