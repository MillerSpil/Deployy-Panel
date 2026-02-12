import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import type { UserWithRole, PanelPermission } from '@deployy/shared';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

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

const BCRYPT_ROUNDS = 14;

export class UserService {
  constructor(private prisma: PrismaClient) {}

  async listUsers(): Promise<UserWithRole[]> {
    const users = await this.prisma.user.findMany({
      include: { role: true },
      orderBy: { email: 'asc' },
    });
    return users.map(this.transformUser);
  }

  async getUser(id: string): Promise<UserWithRole | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
    return user ? this.transformUser(user) : null;
  }

  async getUserByEmail(email: string): Promise<UserWithRole | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { role: true },
    });
    return user ? this.transformUser(user) : null;
  }

  async createUser(data: {
    email: string;
    password: string;
    roleId?: string;
  }): Promise<UserWithRole> {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (existing) {
      throw new AppError(409, 'Email already registered');
    }

    // Validate role if provided
    if (data.roleId) {
      const role = await this.prisma.role.findUnique({ where: { id: data.roleId } });
      if (!role) {
        throw new AppError(400, 'Invalid role ID');
      }
    }

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        roleId: data.roleId,
      },
      include: { role: true },
    });

    logger.info('User created', { userId: user.id, email: user.email });
    return this.transformUser(user);
  }

  async updateUser(
    id: string,
    data: {
      email?: string;
      roleId?: string | null;
    },
    currentUserId: string
  ): Promise<UserWithRole> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // Prevent removing your own admin permissions
    if (id === currentUserId && data.roleId !== undefined) {
      const currentPermissions = user.role
        ? safeParsePermissions(user.role.permissions, 'updateUser:currentRole')
        : [];

      if (currentPermissions.includes('panel.admin')) {
        // User is currently an admin
        if (data.roleId === null) {
          throw new AppError(403, 'Cannot remove your own admin role');
        }

        if (data.roleId) {
          const newRole = await this.prisma.role.findUnique({ where: { id: data.roleId } });
          if (newRole) {
            const newPermissions = safeParsePermissions(newRole.permissions, 'updateUser:newRole');
            if (!newPermissions.includes('panel.admin')) {
              throw new AppError(403, 'Cannot remove your own admin permissions');
            }
          }
        }
      }
    }

    // Check email uniqueness if changing
    if (data.email && data.email.toLowerCase() !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: data.email.toLowerCase() },
      });
      if (existing) {
        throw new AppError(409, 'Email already registered');
      }
    }

    // Validate new role if provided
    if (data.roleId) {
      const role = await this.prisma.role.findUnique({ where: { id: data.roleId } });
      if (!role) {
        throw new AppError(400, 'Invalid role ID');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        email: data.email?.toLowerCase(),
        roleId: data.roleId,
      },
      include: { role: true },
    });

    logger.info('User updated', { userId: id, email: updated.email });
    return this.transformUser(updated);
  }

  async deleteUser(id: string, currentUserId: string): Promise<void> {
    // Can't delete yourself
    if (id === currentUserId) {
      throw new AppError(403, 'Cannot delete your own account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // Check if this is the last admin user
    if (user.role) {
      const permissions = safeParsePermissions(user.role.permissions, 'deleteUser');
      if (permissions.includes('panel.admin')) {
        // Count how many admin users exist
        const adminRoles = await this.prisma.role.findMany({
          where: {
            permissions: { contains: 'panel.admin' },
          },
        });
        const adminRoleIds = adminRoles.map((r) => r.id);

        const adminCount = await this.prisma.user.count({
          where: { roleId: { in: adminRoleIds } },
        });

        if (adminCount <= 1) {
          throw new AppError(403, 'Cannot delete the last admin user');
        }
      }
    }

    // Delete user (ServerAccess will cascade delete)
    await this.prisma.user.delete({ where: { id } });
    logger.info('User deleted', { userId: id, email: user.email });
  }

  private transformUser(
    user: {
      id: string;
      email: string;
      createdAt: Date;
      updatedAt: Date;
      role: {
        id: string;
        name: string;
        description: string | null;
        permissions: string;
        isSystem: boolean;
        createdAt: Date;
        updatedAt: Date;
      } | null;
    }
  ): UserWithRole {
    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      role: user.role
        ? {
            id: user.role.id,
            name: user.role.name,
            description: user.role.description,
            permissions: safeParsePermissions(user.role.permissions, 'transformUser'),
            isSystem: user.role.isSystem,
            createdAt: user.role.createdAt,
            updatedAt: user.role.updatedAt,
          }
        : null,
    };
  }
}
