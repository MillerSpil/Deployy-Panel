import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAuth } from '@/hooks/useAuth';
import { updateApi } from '@/api/update';
import type { UpdateInfo, UpdateProgress, PanelSettings } from '@deployy/shared';

interface UpdateContextType {
  currentVersion: string;
  updateInfo: UpdateInfo | null;
  updateProgress: UpdateProgress | null;
  settings: PanelSettings | null;
  isChecking: boolean;
  isUpdating: boolean;
  error: string | null;
  checkForUpdates: () => Promise<void>;
  applyUpdate: () => Promise<void>;
  dismissUpdate: () => void;
  dismissProgress: () => void;
  updateSettings: (settings: Partial<PanelSettings>) => Promise<void>;
}

const UpdateContext = createContext<UpdateContextType | null>(null);

export function UpdateProvider({ children }: { children: ReactNode }) {
  const socket = useSocket();
  const { isAdmin, user } = useAuth();
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress | null>(null);
  const [settings, setSettings] = useState<PanelSettings | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [updateOperationActive, setUpdateOperationActive] = useState(false);

  const isUpdating = updateOperationActive && updateProgress !== null &&
    updateProgress.status !== 'idle' &&
    updateProgress.status !== 'completed' &&
    updateProgress.status !== 'error';

  // Load version on mount (for any authenticated user)
  useEffect(() => {
    if (user) {
      updateApi.getVersion()
        .then((data) => setCurrentVersion(data.version))
        .catch(() => {});
    }
  }, [user]);

  // Load settings on mount (admin only)
  useEffect(() => {
    if (isAdmin) {
      updateApi.getSettings()
        .then(setSettings)
        .catch(() => {});
    }
  }, [isAdmin]);

  // Auto-check on mount if admin and auto-check enabled
  useEffect(() => {
    if (isAdmin && settings?.autoCheckUpdates && !updateInfo && !isChecking) {
      checkForUpdates();
    }
  }, [isAdmin, settings?.autoCheckUpdates]);

  // Listen for update progress via WebSocket
  useEffect(() => {
    if (!socket) return;

    const handleProgress = (progress: UpdateProgress) => {
      setUpdateProgress(progress);

      // Clear error on new progress
      if (progress.status !== 'error') {
        setError(null);
      } else {
        setError(progress.message);
      }
    };

    socket.on('update:progress', handleProgress);

    return () => {
      socket.off('update:progress', handleProgress);
    };
  }, [socket]);

  const checkForUpdates = useCallback(async () => {
    if (isChecking) return;

    setIsChecking(true);
    setError(null);
    setDismissed(false);

    try {
      const info = await updateApi.checkForUpdates();
      setUpdateInfo(info);
      setCurrentVersion(info.currentVersion);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check for updates');
    } finally {
      setIsChecking(false);
    }
  }, [isChecking]);

  const applyUpdate = useCallback(async () => {
    if (!updateInfo?.updateAvailable || isUpdating) return;

    setError(null);
    setUpdateOperationActive(true);

    try {
      await updateApi.applyUpdate(updateInfo.downloadUrl, updateInfo.latestVersion);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start update');
      setUpdateOperationActive(false);
    }
  }, [updateInfo, isUpdating]);

  const dismissUpdate = useCallback(() => {
    setDismissed(true);
  }, []);

  const dismissProgress = useCallback(() => {
    setUpdateProgress(null);
    setUpdateOperationActive(false);
  }, []);

  const updateSettingsCallback = useCallback(async (newSettings: Partial<PanelSettings>) => {
    const updated = await updateApi.updateSettings(newSettings);
    setSettings(updated);
  }, []);

  const value: UpdateContextType = {
    currentVersion,
    updateInfo: dismissed ? null : updateInfo,
    updateProgress: updateOperationActive ? updateProgress : null,
    settings,
    isChecking,
    isUpdating,
    error,
    checkForUpdates,
    applyUpdate,
    dismissUpdate,
    dismissProgress,
    updateSettings: updateSettingsCallback,
  };

  return (
    <UpdateContext.Provider value={value}>
      {children}
    </UpdateContext.Provider>
  );
}

export function useUpdate() {
  const context = useContext(UpdateContext);
  if (!context) {
    throw new Error('useUpdate must be used within an UpdateProvider');
  }
  return context;
}
