import { z } from 'zod';

const SERVER_NAME_REGEX = /^[a-zA-Z0-9\s\-_]+$/;
const SERVER_PATH_REGEX = /^[a-zA-Z]:\\[\w\s\-\\]+$|^\/[\w\s\-\/]+$/;
const PORT_MIN = 1024;
const PORT_MAX = 65535;

export const createServerSchema = z.object({
  name: z
    .string()
    .min(1, 'Server name is required')
    .max(50, 'Server name must be 50 characters or less')
    .regex(SERVER_NAME_REGEX, 'Server name contains invalid characters'),
  gameType: z.enum(['hytale', 'minecraft']),
  path: z
    .string()
    .min(1, 'Server path is required')
    .max(260, 'Path is too long')
    .regex(SERVER_PATH_REGEX, 'Invalid path format')
    .refine((p) => !p.includes('..'), 'Path cannot contain ".."'),
  port: z
    .number()
    .int()
    .min(PORT_MIN, `Port must be at least ${PORT_MIN}`)
    .max(PORT_MAX, `Port must be at most ${PORT_MAX}`),
  maxPlayers: z
    .number()
    .int()
    .min(1, 'At least 1 player slot required')
    .max(1000, 'Maximum 1000 players'),
  version: z.string().optional(),
});

export const updateServerSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(50)
    .regex(SERVER_NAME_REGEX)
    .optional(),
  maxPlayers: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional(),
  config: z.record(z.unknown()).optional(),
});

export const serverCommandSchema = z.object({
  command: z
    .string()
    .min(1, 'Command cannot be empty')
    .max(500, 'Command too long'),
});

export const serverIdSchema = z.string().uuid('Invalid server ID');

export const validateServerPath = (basePath: string, userPath: string): boolean => {
  const path = require('path');
  const resolvedBase = path.resolve(basePath);
  const resolvedPath = path.resolve(basePath, userPath);
  return resolvedPath.startsWith(resolvedBase);
};

// Auth schemas
export const registerSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .min(1, 'Email is required')
    .max(255, 'Email is too long'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password is too long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
});

// Role schemas
const ROLE_NAME_REGEX = /^[a-zA-Z0-9\s\-_]+$/;

export const createRoleSchema = z.object({
  name: z
    .string()
    .min(1, 'Role name is required')
    .max(50, 'Role name must be 50 characters or less')
    .regex(ROLE_NAME_REGEX, 'Role name contains invalid characters'),
  description: z.string().max(255, 'Description is too long').optional(),
  permissions: z.array(z.string()).default([]),
});

export const updateRoleSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(50)
    .regex(ROLE_NAME_REGEX, 'Role name contains invalid characters')
    .optional(),
  description: z.string().max(255).nullable().optional(),
  permissions: z.array(z.string()).optional(),
});

export const roleIdSchema = z.string().uuid('Invalid role ID');

// User management schemas
export const createUserSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .min(1, 'Email is required')
    .max(255, 'Email is too long'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password is too long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  roleId: z.string().uuid('Invalid role ID').optional(),
});

export const updateUserSchema = z.object({
  email: z.string().email('Invalid email address').min(1).max(255).optional(),
  roleId: z.string().uuid('Invalid role ID').nullable().optional(),
});

export const userIdSchema = z.string().uuid('Invalid user ID');

// Server access schemas
export const grantServerAccessSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  permissionLevel: z.enum(['viewer', 'operator', 'admin', 'owner']),
});

export const updateServerAccessSchema = z.object({
  permissionLevel: z.enum(['viewer', 'operator', 'admin', 'owner']),
});

export const serverAccessIdSchema = z.string().uuid('Invalid access ID');

export const transferOwnershipSchema = z.object({
  newOwnerId: z.string().uuid('Invalid user ID'),
});
