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
