import { useState, useEffect } from 'react';
import { usersApi } from '@/api/users';
import { rolesApi } from '@/api/roles';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Input } from '@/components/common/Input';
import type { UserWithRole, Role } from '@deployy/shared';

export function UsersPage() {
  const { canCreateUser, canEditUser, canDeleteUser, user: currentUser } = usePermissions();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserWithRole | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersData, rolesData] = await Promise.all([usersApi.list(), rolesApi.list()]);
      setUsers(usersData);
      setRoles(rolesData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async () => {
    if (!deletingUser) return;
    try {
      await usersApi.delete(deletingUser.id);
      setDeletingUser(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-slate-400">Loading users...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-red-400">Error: {error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-100">Users</h1>
        {canCreateUser && <Button onClick={() => setIsCreateModalOpen(true)} className="w-full sm:w-auto">Create User</Button>}
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead className="bg-slate-700">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-slate-300">Email</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-slate-300">Role</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-slate-300">Created</th>
              <th className="px-6 py-3 text-right text-sm font-medium text-slate-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-750">
                <td className="px-6 py-4 text-slate-100">
                  {user.email}
                  {user.id === currentUser?.id && (
                    <span className="ml-2 text-xs text-primary-400">(you)</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {user.role ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-900 text-primary-200">
                      {user.role.name}
                    </span>
                  ) : (
                    <span className="text-slate-500">No role</span>
                  )}
                </td>
                <td className="px-6 py-4 text-slate-400 text-sm">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    {canEditUser && (
                      <Button variant="secondary" onClick={() => setEditingUser(user)}>
                        Edit
                      </Button>
                    )}
                    {canDeleteUser && user.id !== currentUser?.id && (
                      <Button variant="danger" onClick={() => setDeletingUser(user)}>
                        Delete
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={fetchData}
        roles={roles}
      />

      <EditUserModal
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onSaved={fetchData}
        roles={roles}
      />

      <Modal isOpen={!!deletingUser} onClose={() => setDeletingUser(null)} title="Delete User">
        <p className="text-slate-300 mb-4">
          Are you sure you want to delete <strong>{deletingUser?.email}</strong>? This action cannot
          be undone.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setDeletingUser(null)} className="flex-1">
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} className="flex-1">
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  roles: Role[];
}

function CreateUserModal({ isOpen, onClose, onCreated, roles }: CreateUserModalProps) {
  const [formData, setFormData] = useState({ email: '', password: '', roleId: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await usersApi.create({
        email: formData.email,
        password: formData.password,
        roleId: formData.roleId || undefined,
      });
      setFormData({ email: '', password: '', roleId: '' });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create User">
      <form onSubmit={handleSubmit}>
        <Input
          label="Email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />
        <Input
          label="Password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          required
          minLength={8}
        />
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-1">Role</label>
          <select
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={formData.roleId}
            onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
          >
            <option value="">No role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? 'Creating...' : 'Create User'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

interface EditUserModalProps {
  user: UserWithRole | null;
  onClose: () => void;
  onSaved: () => void;
  roles: Role[];
}

function EditUserModal({ user, onClose, onSaved, roles }: EditUserModalProps) {
  const [roleId, setRoleId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setRoleId(user.role?.id || '');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      await usersApi.update(user.id, { roleId: roleId || null });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={!!user} onClose={onClose} title="Edit User">
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
          <p className="text-slate-100">{user?.email}</p>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-1">Role</label>
          <select
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
          >
            <option value="">No role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
