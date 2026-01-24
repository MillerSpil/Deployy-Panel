import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import type { AuthUser, AuthUserWithPermissions, PanelPermission } from '@deployy/shared';

const BCRYPT_ROUNDS = 14;

export class AuthService {
  private jwtSecret: string;
  private jwtExpiration: string;

  constructor(private prisma: PrismaClient) {
    this.jwtSecret = process.env.JWT_SECRET || '';
    this.jwtExpiration = process.env.JWT_EXPIRATION || '24h';

    if (!this.jwtSecret || this.jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters');
    }
  }

  async register(email: string, password: string): Promise<AuthUser> {
    // Check if any user exists (single-user setup for self-hosted)
    const existingUserCount = await this.prisma.user.count();
    if (existingUserCount > 0) {
      throw new AppError(403, 'Registration is disabled - user already exists');
    }

    // Check for duplicate email (extra safety)
    const existingUser = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existingUser) {
      throw new AppError(409, 'Email already registered');
    }

    // For first user, find the Admin role
    let roleId: string | undefined;
    const adminRole = await this.prisma.role.findFirst({
      where: { name: 'Admin', isSystem: true },
    });
    if (adminRole) {
      roleId = adminRole.id;
    }

    // Hash password - NEVER log the password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        roleId,
      },
    });

    logger.info('User registered', { userId: user.id, assignedRole: roleId ? 'Admin' : 'none' });

    return { id: user.id, email: user.email };
  }

  async login(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Use same message to prevent email enumeration
      logger.warn('Login attempt for non-existent user', { email: email.toLowerCase() });
      throw new AppError(401, 'Invalid email or password');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      logger.warn('Invalid password attempt', { userId: user.id });
      throw new AppError(401, 'Invalid email or password');
    }

    const signOptions: SignOptions = { expiresIn: this.jwtExpiration as `${number}${'s' | 'm' | 'h' | 'd'}` | number };
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      this.jwtSecret,
      signOptions
    );

    logger.info('User logged in', { userId: user.id });

    return {
      user: { id: user.id, email: user.email },
      token,
    };
  }

  async verifyToken(token: string): Promise<AuthUserWithPermissions> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as { userId: string; email: string };

      // Verify user still exists and get role info
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { role: true },
      });

      if (!user) {
        throw new AppError(401, 'User not found');
      }

      const permissions: PanelPermission[] = user.role
        ? JSON.parse(user.role.permissions)
        : [];

      return {
        id: user.id,
        email: user.email,
        permissions,
        roleId: user.roleId,
        roleName: user.role?.name || null,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(401, 'Invalid or expired token');
    }
  }

  async hasUsers(): Promise<boolean> {
    const count = await this.prisma.user.count();
    return count > 0;
  }
}
