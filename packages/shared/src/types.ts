export type GameType = 'hytale' | 'minecraft';

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed';

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
