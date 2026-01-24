import { useAuth } from './useAuth';
import type { ServerPermissionLevel } from '@deployy/shared';

export function usePermissions() {
  const { user, hasPermission, isAdmin } = useAuth();

  // Check if user can access the admin section at all
  const canAccessAdmin =
    hasPermission('users.view') ||
    hasPermission('users.create') ||
    hasPermission('roles.view') ||
    hasPermission('roles.create');

  // User management permissions
  const canManageUsers = hasPermission('users.view');
  const canCreateUser = hasPermission('users.create');
  const canEditUser = hasPermission('users.edit');
  const canDeleteUser = hasPermission('users.delete');

  // Role management permissions
  const canManageRoles = hasPermission('roles.view');
  const canCreateRole = hasPermission('roles.create');
  const canEditRole = hasPermission('roles.edit');
  const canDeleteRole = hasPermission('roles.delete');

  // Server permissions
  const canCreateServer = hasPermission('servers.create');
  const canViewAllServers = hasPermission('servers.viewAll');

  return {
    user,
    isAdmin,
    canAccessAdmin,
    canManageUsers,
    canCreateUser,
    canEditUser,
    canDeleteUser,
    canManageRoles,
    canCreateRole,
    canEditRole,
    canDeleteRole,
    canCreateServer,
    canViewAllServers,
    hasPermission,
  };
}

/**
 * Check if a user's server permission level meets a required level.
 * Permission levels from lowest to highest: viewer, operator, admin, owner
 */
export function hasServerPermissionLevel(
  userLevel: ServerPermissionLevel | null | undefined,
  requiredLevel: ServerPermissionLevel
): boolean {
  if (!userLevel) return false;

  const levels: ServerPermissionLevel[] = ['viewer', 'operator', 'admin', 'owner'];
  const userLevelIndex = levels.indexOf(userLevel);
  const requiredLevelIndex = levels.indexOf(requiredLevel);

  return userLevelIndex >= requiredLevelIndex;
}
