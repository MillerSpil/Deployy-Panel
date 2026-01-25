import { useUpdate } from '@/contexts/UpdateContext';
import { Modal } from '@/components/common/Modal';

const STATUS_MESSAGES: Record<string, string> = {
  idle: 'Ready',
  checking: 'Checking for updates...',
  downloading: 'Downloading update...',
  extracting: 'Extracting files...',
  backing_up: 'Creating backup...',
  merging_env: 'Merging configuration...',
  replacing_files: 'Updating files...',
  installing_deps: 'Installing dependencies...',
  completed: 'Update complete!',
  error: 'Update failed',
};

export function UpdateProgressModal() {
  const { updateProgress, isUpdating, error, dismissProgress } = useUpdate();

  const isComplete = updateProgress?.status === 'completed';
  const isError = updateProgress?.status === 'error';

  // Show modal when update is in progress or just completed/errored
  const showModal = updateProgress !== null && (
    isUpdating ||
    updateProgress.status === 'completed' ||
    updateProgress.status === 'error'
  );

  if (!showModal) {
    return null;
  }

  // Can close modal when not actively updating
  const canClose = !isUpdating;

  const handleClose = () => {
    if (canClose) {
      dismissProgress();
    }
  };

  return (
    <Modal
      isOpen={showModal}
      onClose={handleClose}
      title={isComplete ? 'Update Complete' : isError ? 'Update Failed' : 'Updating Panel'}
    >
      <div className="space-y-4">
        {/* Progress indicator */}
        {isUpdating && (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
          </div>
        )}

        {/* Status message */}
        <div className="text-center">
          <p className={`text-lg ${isError ? 'text-red-400' : isComplete ? 'text-green-400' : 'text-slate-300'}`}>
            {STATUS_MESSAGES[updateProgress.status] || updateProgress.status}
          </p>
          <p className="text-slate-400 mt-2">{updateProgress.message}</p>
        </div>

        {/* Download progress bar */}
        {updateProgress.status === 'downloading' && updateProgress.progress !== undefined && (
          <div className="w-full bg-slate-700 rounded-full h-2.5">
            <div
              className="bg-primary-500 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${updateProgress.progress}%` }}
            ></div>
          </div>
        )}

        {/* Env changes summary */}
        {updateProgress.envChanges && (
          <div className="bg-slate-700 rounded-lg p-4 mt-4">
            <h4 className="font-medium text-slate-200 mb-2">Configuration Changes</h4>
            {updateProgress.envChanges.added.length > 0 && (
              <div className="text-sm">
                <span className="text-green-400">New options added:</span>
                <ul className="list-disc list-inside text-slate-400 ml-2">
                  {updateProgress.envChanges.added.map((key) => (
                    <li key={key}>{key}</li>
                  ))}
                </ul>
              </div>
            )}
            {updateProgress.envChanges.removed.length > 0 && (
              <div className="text-sm mt-2">
                <span className="text-yellow-400">Deprecated options (kept but may be removed):</span>
                <ul className="list-disc list-inside text-slate-400 ml-2">
                  {updateProgress.envChanges.removed.map((key) => (
                    <li key={key}>{key}</li>
                  ))}
                </ul>
              </div>
            )}
            {updateProgress.envChanges.preserved.length > 0 && (
              <p className="text-sm text-slate-400 mt-2">
                {updateProgress.envChanges.preserved.length} existing settings preserved.
              </p>
            )}
          </div>
        )}

        {/* Completion message */}
        {isComplete && (
          <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 text-center">
            <p className="text-green-400 font-medium">
              Please restart the panel to complete the update.
            </p>
            <p className="text-slate-400 text-sm mt-1">
              Stop and restart the backend server to apply changes.
            </p>
          </div>
        )}

        {/* Error message */}
        {isError && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
            <p className="text-red-400 font-medium">Update failed</p>
            <p className="text-slate-400 text-sm mt-1">
              {error || updateProgress.message}
            </p>
            <p className="text-slate-400 text-sm mt-2">
              You may need to restore from a backup in the Settings page.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
