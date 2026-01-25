import { useUpdate } from '@/contexts/UpdateContext';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';

export function UpdateBanner() {
  const { isAdmin } = useAuth();
  const { updateInfo, isUpdating, applyUpdate, dismissUpdate } = useUpdate();

  // Only show to admins when update is available
  if (!isAdmin || !updateInfo?.updateAvailable) {
    return null;
  }

  return (
    <div className="bg-primary-600 text-white">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="font-medium">
              Update Available: v{updateInfo.latestVersion}
            </span>
            <span className="text-primary-200 text-sm">
              (Current: v{updateInfo.currentVersion})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="white"
              onClick={applyUpdate}
              disabled={isUpdating}
            >
              {isUpdating ? 'Updating...' : `Update to v${updateInfo.latestVersion}`}
            </Button>
            <button
              onClick={dismissUpdate}
              className="text-primary-200 hover:text-white p-1"
              title="Dismiss"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
