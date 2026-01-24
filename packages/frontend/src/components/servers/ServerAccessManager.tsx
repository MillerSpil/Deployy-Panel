import { useState, useEffect } from 'react';
import { serverAccessApi } from '@/api/serverAccess';
import { usersApi } from '@/api/users';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import type { ServerAccess, ServerPermissionLevel, UserWithRole } from '@deployy/shared';

const PERMISSION_LEVEL_LABELS: Record<ServerPermissionLevel, string> = {
  viewer: 'Viewer (read-only)',
  operator: 'Operator (start/stop/commands)',
  admin: 'Admin (full management)',
  owner: 'Owner (full control)',
};

interface ServerAccessManagerProps {
  serverId: string;
  isOwner: boolean;
}

export function ServerAccessManager({ serverId, isOwner }: ServerAccessManagerProps) {
  const [accessList, setAccessList] = useState<ServerAccess[]>([]);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [transferringTo, setTransferringTo] = useState<ServerAccess | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [accessData, usersData] = await Promise.all([
        serverAccessApi.list(serverId),
        usersApi.list().catch(() => []), // Users API may fail if no permission
      ]);
      setAccessList(accessData);
      setUsers(usersData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch access data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [serverId]);

  const handleRevoke = async (accessId: string) => {
    try {
      await serverAccessApi.revoke(serverId, accessId);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke access');
    }
  };

  const handleUpdateLevel = async (accessId: string, level: ServerPermissionLevel) => {
    try {
      await serverAccessApi.update(serverId, accessId, level);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update access level');
    }
  };

  const handleTransferOwnership = async () => {
    if (!transferringTo) return;
    try {
      await serverAccessApi.transferOwnership(serverId, transferringTo.userId);
      setTransferringTo(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transfer ownership');
    }
  };

  if (loading) {
    return <p className="text-slate-400">Loading access data...</p>;
  }

  if (error) {
    return <p className="text-red-400">Error: {error}</p>;
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-slate-100">Server Access</h2>
        {isOwner && (
          <Button onClick={() => setIsGrantModalOpen(true)}>Grant Access</Button>
        )}
      </div>

      {accessList.length === 0 ? (
        <p className="text-slate-500">No access entries found.</p>
      ) : (
        <div className="space-y-3">
          {accessList.map((access) => (
            <div
              key={access.id}
              className="flex items-center justify-between bg-slate-700 rounded-lg p-3"
            >
              <div>
                <p className="text-slate-100">{access.user?.email || access.userId}</p>
                <p className="text-sm text-slate-400">
                  {PERMISSION_LEVEL_LABELS[access.permissionLevel]}
                </p>
              </div>
              {isOwner && access.permissionLevel !== 'owner' && (
                <div className="flex items-center gap-2">
                  <select
                    value={access.permissionLevel}
                    onChange={(e) =>
                      handleUpdateLevel(access.id, e.target.value as ServerPermissionLevel)
                    }
                    className="px-2 py-1 bg-slate-600 border border-slate-500 rounded text-slate-100 text-sm"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="operator">Operator</option>
                    <option value="admin">Admin</option>
                  </select>
                  <Button variant="danger" onClick={() => handleRevoke(access.id)}>
                    Revoke
                  </Button>
                </div>
              )}
              {isOwner && access.permissionLevel === 'owner' && (
                <span className="text-primary-400 text-sm">Current Owner</span>
              )}
            </div>
          ))}
        </div>
      )}

      {isOwner && accessList.length > 1 && (
        <div className="mt-4 pt-4 border-t border-slate-700">
          <h3 className="text-sm font-medium text-slate-300 mb-2">Transfer Ownership</h3>
          <p className="text-slate-400 text-sm mb-2">
            Select a user to transfer server ownership to. You will become an admin.
          </p>
          <select
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100"
            onChange={(e) => {
              const access = accessList.find((a) => a.userId === e.target.value);
              if (access) setTransferringTo(access);
            }}
            value=""
          >
            <option value="">Select user...</option>
            {accessList
              .filter((a) => a.permissionLevel !== 'owner')
              .map((access) => (
                <option key={access.id} value={access.userId}>
                  {access.user?.email || access.userId}
                </option>
              ))}
          </select>
        </div>
      )}

      <GrantAccessModal
        isOpen={isGrantModalOpen}
        onClose={() => setIsGrantModalOpen(false)}
        onGranted={fetchData}
        serverId={serverId}
        users={users}
        existingUserIds={accessList.map((a) => a.userId)}
      />

      <Modal
        isOpen={!!transferringTo}
        onClose={() => setTransferringTo(null)}
        title="Transfer Ownership"
      >
        <p className="text-slate-300 mb-4">
          Are you sure you want to transfer ownership to{' '}
          <strong>{transferringTo?.user?.email}</strong>? You will become an admin instead of
          owner.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setTransferringTo(null)} className="flex-1">
            Cancel
          </Button>
          <Button variant="danger" onClick={handleTransferOwnership} className="flex-1">
            Transfer
          </Button>
        </div>
      </Modal>
    </div>
  );
}

interface GrantAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGranted: () => void;
  serverId: string;
  users: UserWithRole[];
  existingUserIds: string[];
}

function GrantAccessModal({
  isOpen,
  onClose,
  onGranted,
  serverId,
  users,
  existingUserIds,
}: GrantAccessModalProps) {
  const [userId, setUserId] = useState('');
  const [permissionLevel, setPermissionLevel] = useState<ServerPermissionLevel>('viewer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableUsers = users.filter((u) => !existingUserIds.includes(u.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      await serverAccessApi.grant(serverId, { userId, permissionLevel });
      setUserId('');
      setPermissionLevel('viewer');
      onGranted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to grant access');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Grant Server Access">
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-1">User</label>
          <select
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
          >
            <option value="">Select user...</option>
            {availableUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.email}
              </option>
            ))}
          </select>
          {availableUsers.length === 0 && (
            <p className="text-slate-500 text-sm mt-1">
              No users available. All users already have access.
            </p>
          )}
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-1">Permission Level</label>
          <select
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100"
            value={permissionLevel}
            onChange={(e) => setPermissionLevel(e.target.value as ServerPermissionLevel)}
          >
            <option value="viewer">Viewer (read-only)</option>
            <option value="operator">Operator (start/stop/commands)</option>
            <option value="admin">Admin (full management)</option>
          </select>
        </div>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={loading || !userId} className="flex-1">
            {loading ? 'Granting...' : 'Grant Access'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
