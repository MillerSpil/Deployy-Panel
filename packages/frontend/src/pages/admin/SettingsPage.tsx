import { useState, useEffect } from 'react';
import { useUpdate } from '@/contexts/UpdateContext';
import { updateApi } from '@/api/update';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import type { UpdateBackupInfo } from '@deployy/shared';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleString();
}

function formatMarkdown(text: string): string {
  return text
    // Convert headers to uppercase with line breaks
    .replace(/^### (.+)$/gm, '\n$1')
    .replace(/^## (.+)$/gm, '\n$1\n')
    // Convert bold to plain text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    // Convert italic to plain text
    .replace(/\*(.+?)\*/g, '$1')
    // Keep list items but remove the dash
    .replace(/^- (.+)$/gm, '• $1')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function SettingsPage() {
  const {
    currentVersion,
    updateInfo,
    settings,
    isChecking,
    isUpdating,
    error,
    checkForUpdates,
    applyUpdate,
    updateSettings,
  } = useUpdate();

  const [backups, setBackups] = useState<UpdateBackupInfo[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [deletingBackup, setDeletingBackup] = useState<UpdateBackupInfo | null>(null);
  const [rollingBack, setRollingBack] = useState<UpdateBackupInfo | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [lastCheckMessage, setLastCheckMessage] = useState<string | null>(null);

  // Load backups on mount
  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    try {
      setBackupsLoading(true);
      const data = await updateApi.listBackups();
      setBackups(data);
    } catch {
      // Error handled by API client (5xx logged, 4xx shown in UI)
    } finally {
      setBackupsLoading(false);
    }
  };

  const handleAutoCheckToggle = async () => {
    if (!settings) return;
    try {
      setSettingsError(null);
      await updateSettings({ autoCheckUpdates: !settings.autoCheckUpdates });
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Failed to update settings');
    }
  };

  const handleDeleteBackup = async () => {
    if (!deletingBackup) return;
    try {
      setActionLoading(true);
      await updateApi.deleteBackup(deletingBackup.id);
      setDeletingBackup(null);
      loadBackups();
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Failed to delete backup');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRollback = async () => {
    if (!rollingBack) return;
    try {
      setActionLoading(true);
      await updateApi.rollback(rollingBack.id);
      setRollingBack(null);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Failed to start rollback');
    } finally {
      setActionLoading(false);
    }
  };

  const totalBackupSize = backups.reduce((sum, b) => sum + b.size, 0);

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-100 mb-8">Panel Settings</h1>

      {(error || settingsError) && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
          <p className="text-red-400">{error || settingsError}</p>
        </div>
      )}

      {/* Version & Updates Section */}
      <section className="bg-slate-800 rounded-lg border border-slate-700 p-6 mb-6">
        <h2 className="text-xl font-semibold text-slate-100 mb-4">Version & Updates</h2>

        <div className="space-y-4">
          {/* Current Version */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-slate-400">Current Version:</span>
              <span className="ml-2 text-slate-100 font-mono">
                {currentVersion ? `v${currentVersion}` : 'Loading...'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {lastCheckMessage && !isChecking && (
                <span className="text-sm text-slate-400">{lastCheckMessage}</span>
              )}
              <Button
                onClick={async () => {
                  setLastCheckMessage(null);
                  await checkForUpdates();
                  const now = new Date().toLocaleTimeString();
                  setLastCheckMessage(`Checked at ${now}`);
                }}
                disabled={isChecking || isUpdating}
              >
                {isChecking ? 'Checking...' : 'Check for Updates'}
              </Button>
            </div>
          </div>

          {/* Auto-check Toggle */}
          <div className="flex items-center justify-between border-t border-slate-700 pt-4">
            <div>
              <p className="text-slate-100">Automatically check for updates</p>
              <p className="text-slate-400 text-sm">Check for updates when the panel starts</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings?.autoCheckUpdates ?? true}
                onChange={handleAutoCheckToggle}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          {/* Update Available */}
          {updateInfo?.updateAvailable && (
            <div className="border-t border-slate-700 pt-4">
              <div className="bg-primary-900/30 border border-primary-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-medium text-primary-300">
                      Update Available: v{updateInfo.latestVersion}
                    </h3>
                    <p className="text-slate-400 text-sm">
                      Published {formatDate(updateInfo.publishedAt)}
                    </p>
                  </div>
                  <Button onClick={applyUpdate} disabled={isUpdating}>
                    {isUpdating ? 'Updating...' : `Update to v${updateInfo.latestVersion}`}
                  </Button>
                </div>

                {/* Release Notes */}
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-slate-300 mb-2">Release Notes</h4>
                  <div className="bg-slate-900 rounded p-3 max-h-48 overflow-y-auto">
                    <pre className="text-slate-400 text-sm whitespace-pre-wrap font-sans">
                      {formatMarkdown(updateInfo.releaseNotes)}
                    </pre>
                  </div>
                </div>

                <a
                  href={updateInfo.releaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-3 text-primary-400 hover:text-primary-300 text-sm"
                >
                  View on GitHub &rarr;
                </a>
              </div>
            </div>
          )}

          {/* Up to date message or check result */}
          {updateInfo && !updateInfo.updateAvailable && (
            <div className="border-t border-slate-700 pt-4">
              {updateInfo.releaseNotes.startsWith('Could not check') ? (
                <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3">
                  <p className="text-yellow-400 text-sm">{updateInfo.releaseNotes}</p>
                  <p className="text-slate-400 text-sm mt-1">
                    This may be due to GitHub rate limiting or network issues. Try again later.
                  </p>
                </div>
              ) : (
                <p className="text-green-400">Panel is up to date.</p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Backup Management Section */}
      <section className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-100">Update Backups</h2>
          {totalBackupSize > 0 && (
            <span className="text-slate-400 text-sm">
              Total: {formatBytes(totalBackupSize)}
            </span>
          )}
        </div>

        <p className="text-slate-400 text-sm mb-4">
          Backups are created automatically before each update. You can rollback to a previous
          version or delete old backups to free up disk space.
        </p>

        {backupsLoading ? (
          <p className="text-slate-400">Loading backups...</p>
        ) : backups.length === 0 ? (
          <p className="text-slate-400">No backups available.</p>
        ) : (
          <div className="space-y-3">
            {backups.map((backup) => (
              <div
                key={backup.id}
                className="flex items-center justify-between bg-slate-900 rounded-lg p-4"
              >
                <div>
                  <p className="text-slate-100">
                    Version <span className="font-mono">v{backup.version}</span>
                  </p>
                  <p className="text-slate-400 text-sm">
                    {formatDate(backup.createdAt)} &bull; {formatBytes(backup.size)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setRollingBack(backup)}
                    disabled={isUpdating}
                  >
                    Rollback
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => setDeletingBackup(backup)}
                    disabled={isUpdating}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Delete Backup Confirmation Modal */}
      <Modal
        isOpen={!!deletingBackup}
        onClose={() => setDeletingBackup(null)}
        title="Delete Backup"
      >
        <p className="text-slate-300 mb-4">
          Are you sure you want to delete the backup for{' '}
          <strong>v{deletingBackup?.version}</strong>? This action cannot be undone.
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => setDeletingBackup(null)}
            className="flex-1"
            disabled={actionLoading}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDeleteBackup}
            className="flex-1"
            disabled={actionLoading}
          >
            {actionLoading ? 'Deleting...' : 'Delete Backup'}
          </Button>
        </div>
      </Modal>

      {/* Rollback Confirmation Modal */}
      <Modal
        isOpen={!!rollingBack}
        onClose={() => setRollingBack(null)}
        title="Rollback to Previous Version"
      >
        <p className="text-slate-300 mb-4">
          Are you sure you want to rollback to <strong>v{rollingBack?.version}</strong>?
        </p>
        <p className="text-yellow-400 text-sm mb-4">
          Warning: Make sure all servers are stopped before rolling back. You will need to restart
          the panel after the rollback completes.
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => setRollingBack(null)}
            className="flex-1"
            disabled={actionLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRollback}
            className="flex-1"
            disabled={actionLoading}
          >
            {actionLoading ? 'Starting...' : 'Rollback'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
