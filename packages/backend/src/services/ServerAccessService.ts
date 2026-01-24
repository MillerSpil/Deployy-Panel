import { PrismaClient } from '@prisma/client';
import type { ServerAccess, ServerPermissionLevel } from '@deployy/shared';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

export class ServerAccessService {
  constructor(private prisma: PrismaClient) {}

  async listServerAccess(serverId: string): Promise<ServerAccess[]> {
    const entries = await this.prisma.serverAccess.findMany({
      where: { serverId },
      include: { user: { select: { id: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return entries.map(this.transformAccess);
  }

  async getServerAccess(userId: string, serverId: string): Promise<ServerAccess | null> {
    const access = await this.prisma.serverAccess.findUnique({
      where: { userId_serverId: { userId, serverId } },
      include: { user: { select: { id: true, email: true } } },
    });
    return access ? this.transformAccess(access) : null;
  }

  async grantAccess(data: {
    userId: string;
    serverId: string;
    permissionLevel: ServerPermissionLevel;
  }): Promise<ServerAccess> {
    // Verify user and server exist
    const [user, server] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: data.userId } }),
      this.prisma.server.findUnique({ where: { id: data.serverId } }),
    ]);

    if (!user) throw new AppError(404, 'User not found');
    if (!server) throw new AppError(404, 'Server not found');

    // Check if access already exists
    const existing = await this.prisma.serverAccess.findUnique({
      where: { userId_serverId: { userId: data.userId, serverId: data.serverId } },
    });

    if (existing) {
      throw new AppError(409, 'User already has access to this server');
    }

    const access = await this.prisma.serverAccess.create({
      data: {
        userId: data.userId,
        serverId: data.serverId,
        permissionLevel: data.permissionLevel,
      },
      include: { user: { select: { id: true, email: true } } },
    });

    logger.info('Server access granted', {
      accessId: access.id,
      userId: data.userId,
      serverId: data.serverId,
      level: data.permissionLevel,
    });
    return this.transformAccess(access);
  }

  async updateAccess(accessId: string, permissionLevel: ServerPermissionLevel): Promise<ServerAccess> {
    const existing = await this.prisma.serverAccess.findUnique({
      where: { id: accessId },
    });

    if (!existing) {
      throw new AppError(404, 'Access entry not found');
    }

    // Cannot downgrade owner (must use transferOwnership)
    if (existing.permissionLevel === 'owner' && permissionLevel !== 'owner') {
      throw new AppError(403, 'Cannot downgrade owner. Transfer ownership first.');
    }

    // Cannot upgrade to owner via update (must use transferOwnership)
    if (permissionLevel === 'owner' && existing.permissionLevel !== 'owner') {
      throw new AppError(403, 'Use transfer ownership to make someone owner');
    }

    const updated = await this.prisma.serverAccess.update({
      where: { id: accessId },
      data: { permissionLevel },
      include: { user: { select: { id: true, email: true } } },
    });

    logger.info('Server access updated', { accessId, level: permissionLevel });
    return this.transformAccess(updated);
  }

  async revokeAccess(accessId: string): Promise<void> {
    const existing = await this.prisma.serverAccess.findUnique({
      where: { id: accessId },
    });

    if (!existing) {
      throw new AppError(404, 'Access entry not found');
    }

    if (existing.permissionLevel === 'owner') {
      throw new AppError(403, 'Cannot revoke owner access. Transfer ownership first.');
    }

    await this.prisma.serverAccess.delete({ where: { id: accessId } });
    logger.info('Server access revoked', { accessId });
  }

  async transferOwnership(serverId: string, newOwnerId: string, currentOwnerId: string): Promise<void> {
    // Verify new owner exists
    const newUser = await this.prisma.user.findUnique({ where: { id: newOwnerId } });
    if (!newUser) {
      throw new AppError(404, 'New owner user not found');
    }

    // Verify server exists
    const server = await this.prisma.server.findUnique({ where: { id: serverId } });
    if (!server) {
      throw new AppError(404, 'Server not found');
    }

    // Can't transfer to yourself
    if (newOwnerId === currentOwnerId) {
      throw new AppError(400, 'Cannot transfer ownership to yourself');
    }

    await this.prisma.$transaction(async (tx) => {
      // Downgrade current owner to admin
      await tx.serverAccess.updateMany({
        where: { serverId, userId: currentOwnerId, permissionLevel: 'owner' },
        data: { permissionLevel: 'admin' },
      });

      // Check if new owner already has access
      const existingAccess = await tx.serverAccess.findUnique({
        where: { userId_serverId: { userId: newOwnerId, serverId } },
      });

      if (existingAccess) {
        // Upgrade to owner
        await tx.serverAccess.update({
          where: { id: existingAccess.id },
          data: { permissionLevel: 'owner' },
        });
      } else {
        // Create owner access
        await tx.serverAccess.create({
          data: { userId: newOwnerId, serverId, permissionLevel: 'owner' },
        });
      }
    });

    logger.info('Server ownership transferred', {
      serverId,
      newOwnerId,
      previousOwnerId: currentOwnerId,
    });
  }

  /**
   * Auto-grant owner access when a server is created.
   */
  async grantOwnerOnCreate(userId: string, serverId: string): Promise<void> {
    await this.prisma.serverAccess.create({
      data: {
        userId,
        serverId,
        permissionLevel: 'owner',
      },
    });
    logger.info('Owner access granted for new server', { userId, serverId });
  }

  private transformAccess(access: {
    id: string;
    userId: string;
    serverId: string;
    permissionLevel: string;
    createdAt: Date;
    user?: { id: string; email: string };
  }): ServerAccess {
    return {
      id: access.id,
      userId: access.userId,
      serverId: access.serverId,
      permissionLevel: access.permissionLevel as ServerPermissionLevel,
      createdAt: access.createdAt,
      user: access.user,
    };
  }
}
