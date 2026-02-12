import { PrismaClient } from '@prisma/client';
import type { Role, PanelPermission } from '@deployy/shared';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

function safeParsePermissions(raw: string, context?: string): PanelPermission[] {
  try {
    return JSON.parse(raw);
  } catch (err) {
    logger.error(`Failed to parse permissions JSON${context ? ` (${context})` : ''}`, { raw, error: err });
    return [];
  }
}

export class RoleService {
  constructor(private prisma: PrismaClient) {}

  async listRoles(): Promise<Role[]> {
    const roles = await this.prisma.role.findMany({
      orderBy: { name: 'asc' },
    });
    return roles.map(this.transformRole);
  }

  async getRole(id: string): Promise<Role | null> {
    const role = await this.prisma.role.findUnique({ where: { id } });
    return role ? this.transformRole(role) : null;
  }

  async getRoleByName(name: string): Promise<Role | null> {
    const role = await this.prisma.role.findUnique({ where: { name } });
    return role ? this.transformRole(role) : null;
  }

  async createRole(data: {
    name: string;
    description?: string;
    permissions: PanelPermission[];
  }): Promise<Role> {
    const existing = await this.prisma.role.findUnique({
      where: { name: data.name },
    });
    if (existing) {
      throw new AppError(409, 'Role name already exists');
    }

    const role = await this.prisma.role.create({
      data: {
        name: data.name,
        description: data.description,
        permissions: JSON.stringify(data.permissions),
        isSystem: false,
      },
    });

    logger.info('Role created', { roleId: role.id, roleName: role.name });
    return this.transformRole(role);
  }

  async updateRole(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      permissions?: PanelPermission[];
    }
  ): Promise<Role> {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new AppError(404, 'Role not found');
    }

    // System roles cannot have their permissions modified
    if (role.isSystem && data.permissions !== undefined) {
      throw new AppError(403, 'Cannot modify permissions of system roles');
    }

    // Check for name uniqueness if name is being changed
    if (data.name && data.name !== role.name) {
      const existing = await this.prisma.role.findUnique({
        where: { name: data.name },
      });
      if (existing) {
        throw new AppError(409, 'Role name already exists');
      }
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        permissions: data.permissions ? JSON.stringify(data.permissions) : undefined,
      },
    });

    logger.info('Role updated', { roleId: id, roleName: updated.name });
    return this.transformRole(updated);
  }

  async deleteRole(id: string): Promise<void> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { users: { select: { id: true } } },
    });

    if (!role) {
      throw new AppError(404, 'Role not found');
    }

    if (role.isSystem) {
      throw new AppError(403, 'Cannot delete system roles');
    }

    if (role.users.length > 0) {
      throw new AppError(400, 'Cannot delete role with assigned users. Reassign users first.');
    }

    await this.prisma.role.delete({ where: { id } });
    logger.info('Role deleted', { roleId: id, roleName: role.name });
  }

  private transformRole(role: {
    id: string;
    name: string;
    description: string | null;
    permissions: string;
    isSystem: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Role {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: safeParsePermissions(role.permissions, `transformRole:${role.name}`),
      isSystem: role.isSystem,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}
