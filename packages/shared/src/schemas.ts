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

// Backup schemas
const BACKUP_NAME_REGEX = /^[a-zA-Z0-9\s\-_]+$/;

export const createBackupSchema = z.object({
  name: z
    .string()
    .min(1, 'Backup name is required')
    .max(100, 'Backup name must be 100 characters or less')
    .regex(BACKUP_NAME_REGEX, 'Backup name contains invalid characters')
    .optional(),
});

export const backupIdSchema = z.string().uuid('Invalid backup ID');

export const updateBackupRetentionSchema = z.object({
  backupRetention: z
    .number()
    .int()
    .min(0, 'Retention must be 0 or greater (0 = keep all)')
    .max(100, 'Maximum retention is 100 backups'),
});

// File Manager schemas
const FILE_PATH_REGEX = /^[^<>:"|?*\x00-\x1f]*$/;
const FILE_NAME_REGEX = /^[^<>:"/\\|?*\x00-\x1f]+$/;

export const listFilesSchema = z.object({
  path: z
    .string()
    .default('')
    .refine((p) => !p.includes('..'), 'Path cannot contain ".."'),
});

export const readFileSchema = z.object({
  path: z
    .string()
    .min(1, 'File path is required')
    .regex(FILE_PATH_REGEX, 'Invalid path characters')
    .refine((p) => !p.includes('..'), 'Path cannot contain ".."'),
});

export const writeFileSchema = z.object({
  path: z
    .string()
    .min(1, 'File path is required')
    .regex(FILE_PATH_REGEX, 'Invalid path characters')
    .refine((p) => !p.includes('..'), 'Path cannot contain ".."'),
  content: z.string(),
});

export const createFileSchema = z.object({
  path: z
    .string()
    .min(1, 'File path is required')
    .regex(FILE_PATH_REGEX, 'Invalid path characters')
    .refine((p) => !p.includes('..'), 'Path cannot contain ".."'),
  type: z.enum(['file', 'directory']),
});

export const deleteFileSchema = z.object({
  path: z
    .string()
    .min(1, 'File path is required')
    .regex(FILE_PATH_REGEX, 'Invalid path characters')
    .refine((p) => !p.includes('..'), 'Path cannot contain ".."'),
});

export const renameFileSchema = z.object({
  oldPath: z
    .string()
    .min(1, 'Current path is required')
    .regex(FILE_PATH_REGEX, 'Invalid path characters')
    .refine((p) => !p.includes('..'), 'Path cannot contain ".."'),
  newName: z
    .string()
    .min(1, 'New name is required')
    .max(255, 'Name is too long')
    .regex(FILE_NAME_REGEX, 'Invalid file name characters'),
});

// Scheduled Task schemas
const SCHEDULE_IDS = [
  'every_1h',
  'every_3h',
  'every_6h',
  'every_12h',
  'daily_00:00',
  'daily_03:00',
  'daily_06:00',
  'daily_12:00',
  'daily_18:00',
  'weekly_sunday',
  'weekly_monday',
] as const;

const TASK_TYPES = ['restart', 'backup', 'command'] as const;

export const scheduledTaskConfigSchema = z.object({
  command: z.string().max(500, 'Command is too long').optional(),
  backupName: z
    .string()
    .max(100, 'Backup name is too long')
    .regex(/^[a-zA-Z0-9\s\-_]*$/, 'Backup name contains invalid characters')
    .optional(),
});

export const createScheduledTaskSchema = z.object({
  type: z.enum(TASK_TYPES, { required_error: 'Task type is required' }),
  schedule: z.enum(SCHEDULE_IDS, { required_error: 'Schedule is required' }),
  enabled: z.boolean().default(true),
  config: scheduledTaskConfigSchema.optional(),
});

export const updateScheduledTaskSchema = z.object({
  schedule: z.enum(SCHEDULE_IDS).optional(),
  enabled: z.boolean().optional(),
  config: scheduledTaskConfigSchema.optional(),
});

export const scheduledTaskIdSchema = z.string().uuid('Invalid task ID');
