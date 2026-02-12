import { PrismaClient } from '@prisma/client';
import type { PanelPermission, ServerPermissionLevel } from '@deployy/shared';
import { logger } from '../utils/logger.js';

const PERMISSION_LEVELS: ServerPermissionLevel[] = ['viewer', 'operator', 'admin', 'owner'];

/**
 * Safely parse a JSON permissions string, returning empty array on failure.
 */
function safeParsePermissions(raw: string, context?: string): PanelPermission[] {
  try {
    return JSON.parse(raw);
  } catch (err) {
    logger.error(`Failed to parse permissions JSON${context ? ` (${context})` : ''}`, { raw, error: err });
    return [];
  }
}

export class PermissionService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Check if user has a panel-level permission.
   * panel.admin bypasses all permission checks.
   */
  async hasPanelPermission(userId: string, permission: PanelPermission): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user || !user.role) return false;

    const permissions = safeParsePermissions(user.role.permissions, `hasPanelPermission:${user.role.name}`);

    // panel.admin bypasses all permission checks
    if (permissions.includes('panel.admin')) return true;

    return permissions.includes(permission);
  }

  /**
   * Check if user has required permission level for a server.
   * panel.admin bypasses all checks.
   */
  async hasServerPermission(
    userId: string,
    serverId: string,
    requiredLevel: ServerPermissionLevel
  ): Promise<boolean> {
    // First check for panel.admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (user?.role) {
      const permissions = safeParsePermissions(user.role.permissions, `hasServerPermission:${user.role.name}`);
      if (permissions.includes('panel.admin')) return true;
    }

    // Check server-specific access
    const access = await this.prisma.serverAccess.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });

    if (!access) return false;

    const userLevelIndex = PERMISSION_LEVELS.indexOf(access.permissionLevel as ServerPermissionLevel);
    const requiredLevelIndex = PERMISSION_LEVELS.indexOf(requiredLevel);

    return userLevelIndex >= requiredLevelIndex;
  }

  /**
   * Get user's permission level for a specific server.
   * Returns null if user has no access.
   */
  async getServerPermissionLevel(
    userId: string,
    serverId: string
  ): Promise<ServerPermissionLevel | null> {
    // Check for panel.admin first - they effectively have owner access everywhere
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (user?.role) {
      const permissions = safeParsePermissions(user.role.permissions, `getServerPermissionLevel:${user.role.name}`);
      if (permissions.includes('panel.admin')) return 'owner';
    }

    const access = await this.prisma.serverAccess.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });

    return access?.permissionLevel as ServerPermissionLevel | null;
  }

  /**
   * Get all servers user has access to.
   * Returns 'all' if user has panel.admin or servers.viewAll.
   */
  async getAccessibleServerIds(userId: string): Promise<string[] | 'all'> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (user?.role) {
      const permissions = safeParsePermissions(user.role.permissions, `getAccessibleServerIds:${user.role.name}`);
      if (permissions.includes('panel.admin') || permissions.includes('servers.viewAll')) {
        return 'all';
      }
    }

    const accessEntries = await this.prisma.serverAccess.findMany({
      where: { userId },
      select: { serverId: true },
    });

    return accessEntries.map((a) => a.serverId);
  }

  /**
   * Get user's panel permissions array.
   */
  async getUserPanelPermissions(userId: string): Promise<PanelPermission[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user?.role) return [];
    return safeParsePermissions(user.role.permissions, `getUserPanelPermissions:${user.role.name}`);
  }

  /**
   * Check if user can create servers.
   */
  async canCreateServer(userId: string): Promise<boolean> {
    return this.hasPanelPermission(userId, 'servers.create');
  }
}
