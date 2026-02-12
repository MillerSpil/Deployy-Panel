export type GameType = 'hytale' | 'minecraft';

export type MinecraftFlavor = 'vanilla' | 'paper';

// RAM is specified in gigabytes as a whole number (e.g., 4 = 4GB)

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed';

// Hytale server download status
export type HytaleDownloadStatus =
  | 'downloading_tool'
  | 'extracting_tool'
  | 'waiting_auth'
  | 'downloading_server'
  | 'extracting_server'
  | 'cleanup'
  | 'completed'
  | 'error';

// Minecraft server download status
export type MinecraftDownloadStatus =
  | 'checking_version'
  | 'downloading'
  | 'completed'
  | 'error';

export interface Server {
  id: string;
  name: string;
  gameType: GameType;
  status: ServerStatus;
  port: number;
  maxPlayers: number;
  path: string;
  version?: string;
  backupRetention: number;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Backup {
  id: string;
  serverId: string;
  name: string;
  filename: string;
  size: number;
  path: string;
  createdAt: Date;
}

export interface PerformanceMetrics {
  cpu: number;
  memory: number;
  uptime: number;
  players: number;
}

export interface InstallConfig {
  name: string;
  port: number;
  maxPlayers: number;
  version?: string;
  installPath: string;
  ram?: number;
  flavor?: MinecraftFlavor;
}

export interface InstallResult {
  success: boolean;
  path: string;
  version: string;
  error?: string;
}

export interface GameConfig {
  ServerName: string;
  MOTD: string;
  MaxPlayers: number;
  MaxViewRadius: number;
  [key: string]: unknown;
}

// Auth types
export interface User {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface LoginResponse {
  user: AuthUser;
  message: string;
}

export interface AuthStatus {
  authenticated: boolean;
  user?: AuthUserWithPermissions;
}

// Panel-wide permissions
export const PANEL_PERMISSIONS = [
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
] as const;

export type PanelPermission = (typeof PANEL_PERMISSIONS)[number];

// Per-server permission levels (ordered by privilege, lowest to highest)
export const SERVER_PERMISSION_LEVELS = ['viewer', 'operator', 'admin', 'owner'] as const;
export type ServerPermissionLevel = (typeof SERVER_PERMISSION_LEVELS)[number];

// Minimum permission level required for each server action
export const SERVER_ACTION_PERMISSIONS: Record<string, ServerPermissionLevel> = {
  view: 'viewer',
  viewConsole: 'viewer',
  viewLogs: 'viewer',
  start: 'operator',
  stop: 'operator',
  restart: 'operator',
  sendCommand: 'operator',
  editSettings: 'admin',
  manageFiles: 'admin',
  manageBackups: 'admin',
  manageAccess: 'owner',
  delete: 'owner',
};

// Role model
export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: PanelPermission[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Server access entry
export interface ServerAccess {
  id: string;
  userId: string;
  serverId: string;
  permissionLevel: ServerPermissionLevel;
  createdAt: Date;
  user?: Pick<User, 'id' | 'email'>;
}

// User with role info
export interface UserWithRole extends User {
  role: Role | null;
}

// Extended AuthUser with permissions for JWT and context
export interface AuthUserWithPermissions extends AuthUser {
  permissions: PanelPermission[];
  roleId: string | null;
  roleName: string | null;
}

// Server with user's permission level
export interface ServerWithPermissions extends Server {
  userPermissionLevel: ServerPermissionLevel | null;
}

// File Manager types
export interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  extension?: string;
}

export interface FileContent {
  path: string;
  content: string;
  size: number;
  modified: string;
}

// Binary file extensions that cannot be edited
export const BINARY_EXTENSIONS = [
  '.jar', '.exe', '.dll', '.so', '.dylib',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.bmp', '.webp',
  '.mp3', '.wav', '.ogg', '.mp4', '.avi', '.mkv',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.class', '.pyc', '.o', '.obj',
  '.db', '.sqlite', '.sqlite3',
] as const;

// Text file extensions with syntax highlighting support
export const TEXT_EXTENSIONS: Record<string, string> = {
  '.json': 'json',
  '.properties': 'ini',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.txt': 'plaintext',
  '.log': 'plaintext',
  '.md': 'markdown',
  '.xml': 'xml',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.js': 'javascript',
  '.ts': 'typescript',
  '.sh': 'shell',
  '.bat': 'bat',
  '.cmd': 'bat',
  '.ps1': 'powershell',
  '.py': 'python',
  '.java': 'java',
  '.cfg': 'ini',
  '.conf': 'ini',
  '.ini': 'ini',
  '.toml': 'ini',
};

// Scheduled Tasks types
export const SCHEDULED_TASK_TYPES = ['restart', 'backup', 'command'] as const;
export type ScheduledTaskType = (typeof SCHEDULED_TASK_TYPES)[number];

// Predefined schedule options with human-readable labels
export const SCHEDULE_OPTIONS = [
  { id: 'every_1h', label: 'Every hour', cron: '0 * * * *' },
  { id: 'every_3h', label: 'Every 3 hours', cron: '0 */3 * * *' },
  { id: 'every_6h', label: 'Every 6 hours', cron: '0 */6 * * *' },
  { id: 'every_12h', label: 'Every 12 hours', cron: '0 */12 * * *' },
  { id: 'daily_00:00', label: 'Daily at midnight', cron: '0 0 * * *' },
  { id: 'daily_03:00', label: 'Daily at 3:00 AM', cron: '0 3 * * *' },
  { id: 'daily_06:00', label: 'Daily at 6:00 AM', cron: '0 6 * * *' },
  { id: 'daily_12:00', label: 'Daily at noon', cron: '0 12 * * *' },
  { id: 'daily_18:00', label: 'Daily at 6:00 PM', cron: '0 18 * * *' },
  { id: 'weekly_sunday', label: 'Weekly on Sunday at midnight', cron: '0 0 * * 0' },
  { id: 'weekly_monday', label: 'Weekly on Monday at midnight', cron: '0 0 * * 1' },
] as const;

export type ScheduleId = (typeof SCHEDULE_OPTIONS)[number]['id'];

export interface ScheduledTaskConfig {
  command?: string; // For 'command' type
  backupName?: string; // For 'backup' type
}

export interface ScheduledTask {
  id: string;
  serverId: string;
  type: ScheduledTaskType;
  schedule: ScheduleId;
  enabled: boolean;
  config: ScheduledTaskConfig;
  lastRun: Date | null;
  nextRun: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateScheduledTaskInput {
  type: ScheduledTaskType;
  schedule: ScheduleId;
  enabled?: boolean;
  config?: ScheduledTaskConfig;
}

export interface UpdateScheduledTaskInput {
  schedule?: ScheduleId;
  enabled?: boolean;
  config?: ScheduledTaskConfig;
}

// Panel Update types
export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'extracting'
  | 'backing_up'
  | 'merging_env'
  | 'replacing_files'
  | 'installing_deps'
  | 'completed'
  | 'error';

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseUrl: string;
  releaseNotes: string;
  publishedAt: string;
  downloadUrl: string;
}

export interface PanelSettings {
  autoCheckUpdates: boolean;
}

export interface EnvMergeResult {
  added: string[];
  preserved: string[];
  removed: string[];
}

export interface UpdateBackupInfo {
  id: string;
  version: string;
  backupPath: string;
  size: number;
  createdAt: Date;
}

export interface UpdateProgress {
  status: UpdateStatus;
  message: string;
  progress?: number;
  envChanges?: EnvMergeResult;
}

