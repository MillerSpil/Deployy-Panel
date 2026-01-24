import { useState, useEffect } from 'react';
import { rolesApi } from '@/api/roles';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Input } from '@/components/common/Input';
import type { Role, PanelPermission } from '@deployy/shared';

const ALL_PERMISSIONS: PanelPermission[] = [
  'panel.admin',
  'servers.create',
  'servers.viewAll',
  'users.view',
  'users.create',
  'users.edit',
  'users.delete',
  'roles.view',
  'roles.create',
  'roles.edit',
  'roles.delete',
];

const PERMISSION_LABELS: Record<PanelPermission, string> = {
  'panel.admin': 'Panel Admin (Full Access)',
  'servers.create': 'Create Servers',
  'servers.viewAll': 'View All Servers',
  'users.view': 'View Users',
  'users.create': 'Create Users',
  'users.edit': 'Edit Users',
  'users.delete': 'Delete Users',
  'roles.view': 'View Roles',
  'roles.create': 'Create Roles',
  'roles.edit': 'Edit Roles',
  'roles.delete': 'Delete Roles',
};

export function RolesPage() {
  const { canCreateRole, canEditRole, canDeleteRole } = usePermissions();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const data = await rolesApi.list();
      setRoles(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch roles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleDelete = async () => {
    if (!deletingRole) return;
    try {
      await rolesApi.delete(deletingRole.id);
      setDeletingRole(null);
      fetchRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete role');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-slate-400">Loading roles...</p>
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
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-100">Roles</h1>
        {canCreateRole && <Button onClick={() => setIsCreateModalOpen(true)}>Create Role</Button>}
      </div>

      <div className="grid gap-4">
        {roles.map((role) => (
          <div
            key={role.id}
            className="bg-slate-800 rounded-lg border border-slate-700 p-6"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold text-slate-100">{role.name}</h2>
                  {role.isSystem && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-600 text-slate-300">
                      System
                    </span>
                  )}
                </div>
                {role.description && (
                  <p className="text-slate-400 mt-1">{role.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                {canEditRole && !role.isSystem && (
                  <Button variant="secondary" onClick={() => setEditingRole(role)}>
                    Edit
                  </Button>
                )}
                {canDeleteRole && !role.isSystem && (
                  <Button variant="danger" onClick={() => setDeletingRole(role)}>
                    Delete
                  </Button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {role.permissions.length === 0 ? (
                <span className="text-slate-500 text-sm">No permissions</span>
              ) : (
                role.permissions.map((permission) => (
                  <span
                    key={permission}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-900 text-primary-200"
                  >
                    {PERMISSION_LABELS[permission] || permission}
                  </span>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <CreateRoleModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={fetchRoles}
      />

      <EditRoleModal role={editingRole} onClose={() => setEditingRole(null)} onSaved={fetchRoles} />

      <Modal isOpen={!!deletingRole} onClose={() => setDeletingRole(null)} title="Delete Role">
        <p className="text-slate-300 mb-4">
          Are you sure you want to delete the <strong>{deletingRole?.name}</strong> role? This action
          cannot be undone.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setDeletingRole(null)} className="flex-1">
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

interface CreateRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function CreateRoleModal({ isOpen, onClose, onCreated }: CreateRoleModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as PanelPermission[],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const togglePermission = (permission: PanelPermission) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await rolesApi.create({
        name: formData.name,
        description: formData.description || undefined,
        permissions: formData.permissions,
      });
      setFormData({ name: '', description: '', permissions: [] });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create role');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Role">
      <form onSubmit={handleSubmit}>
        <Input
          label="Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
        <Input
          label="Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">Permissions</label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {ALL_PERMISSIONS.map((permission) => (
              <label key={permission} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.permissions.includes(permission)}
                  onChange={() => togglePermission(permission)}
                  className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-slate-300 text-sm">{PERMISSION_LABELS[permission]}</span>
              </label>
            ))}
          </div>
        </div>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? 'Creating...' : 'Create Role'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

interface EditRoleModalProps {
  role: Role | null;
  onClose: () => void;
  onSaved: () => void;
}

function EditRoleModal({ role, onClose, onSaved }: EditRoleModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as PanelPermission[],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (role) {
      setFormData({
        name: role.name,
        description: role.description || '',
        permissions: [...role.permissions],
      });
    }
  }, [role]);

  const togglePermission = (permission: PanelPermission) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) return;

    setLoading(true);
    setError(null);

    try {
      await rolesApi.update(role.id, {
        name: formData.name,
        description: formData.description || null,
        permissions: formData.permissions,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={!!role} onClose={onClose} title="Edit Role">
      <form onSubmit={handleSubmit}>
        <Input
          label="Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
        <Input
          label="Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">Permissions</label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {ALL_PERMISSIONS.map((permission) => (
              <label key={permission} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.permissions.includes(permission)}
                  onChange={() => togglePermission(permission)}
                  className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-slate-300 text-sm">{PERMISSION_LABELS[permission]}</span>
              </label>
            ))}
          </div>
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
