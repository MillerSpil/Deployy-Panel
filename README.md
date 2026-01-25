# Deployy Panel

Open-source, multi-game server management platform. Start with Hytale, expand to Minecraft and beyond.

## Features

- **Multi-Server Management** - Create and manage multiple game servers from a single dashboard
- **Dynamic Server Settings** - Auto-generated config editor based on each game's JSON config
- **Backup System** - Create, restore, and manage backups with configurable retention policies
- **File Manager** - Browse, view, edit, upload, and download server files with Monaco Editor
- **Scheduled Tasks** - Automate server restarts, backups, and custom commands with cron-based scheduling
- **Roles & Permissions** - Granular access control with panel-wide roles and per-server permissions
- **Real-Time Console** - Live server logs with ANSI color support and command input
- **WebSocket Updates** - Instant status updates across all connected clients
- **Secure Authentication** - JWT-based auth with HTTP-only cookies, bcrypt password hashing
- **Multi-User Support** - Create multiple users with different roles and access levels
- **Cross-Platform** - Works on Windows and Linux
- **Game Adapters** - Extensible architecture for adding new game support
- **Dark Theme** - Modern, eye-friendly interface

## Tech Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS, Vite, Socket.IO
- **Backend:** Node.js, Express, Prisma (SQLite), Socket.IO, Zod
- **Monorepo:** pnpm workspaces

## Requirements

- Node.js 20+
- pnpm 8+
- Java 25+ (for Hytale servers)

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/MillerSpil/Deployy-Panel.git
cd Deployy-Panel
pnpm install
```

### 2. Initialize Database

```bash
cd packages/backend
pnpm prisma generate
pnpm prisma db push
pnpm prisma db seed
```

This creates the database schema and seeds default roles (Admin, Moderator, User).

### 3. Start Development Servers

```bash
# Terminal 1 - Backend (port 3000)
cd packages/backend
pnpm dev

# Terminal 2 - Frontend (port 5173)
cd packages/frontend
pnpm dev
```

### 4. Open Dashboard

Navigate to [http://localhost:5173](http://localhost:5173)

## Project Structure

```
Deployy-Panel/
├── packages/
│   ├── backend/          # Express API server
│   │   ├── src/
│   │   │   ├── adapters/     # Game-specific adapters
│   │   │   ├── routes/       # API routes
│   │   │   ├── services/     # Business logic
│   │   │   ├── websocket/    # Socket.IO handlers
│   │   │   └── utils/        # Utilities
│   │   └── prisma/           # Database schema
│   │
│   ├── frontend/         # React web app
│   │   └── src/
│   │       ├── components/   # UI components
│   │       ├── pages/        # Route pages
│   │       ├── hooks/        # Custom hooks
│   │       └── api/          # API client
│   │
│   └── shared/           # Shared TypeScript types
│       └── src/
│           ├── types.ts
│           └── schemas.ts
│
├── package.json          # Root workspace config
└── pnpm-workspace.yaml
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/setup-status` | Check if initial setup is needed |
| POST | `/api/auth/register` | Create admin account (first-time only) |
| POST | `/api/auth/login` | Login and receive auth cookie |
| POST | `/api/auth/logout` | Logout and clear auth cookie |
| GET | `/api/auth/me` | Get current authenticated user |

### Servers (Protected)

Server endpoints require authentication and appropriate permissions.

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/servers` | List accessible servers | Any authenticated |
| POST | `/api/servers` | Create new server | `servers.create` |
| GET | `/api/servers/:id` | Get server details | Viewer+ |
| DELETE | `/api/servers/:id` | Delete server | Owner |
| POST | `/api/servers/:id/start` | Start server | Operator+ |
| POST | `/api/servers/:id/stop` | Stop server | Operator+ |
| POST | `/api/servers/:id/restart` | Restart server | Operator+ |
| GET | `/api/servers/:id/config` | Get server config | Admin+ |
| PATCH | `/api/servers/:id/config` | Update server config | Admin+ |
| POST | `/api/servers/:id/download` | Start Hytale server file download | Admin+ |

### Backups (Protected)

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/servers/:id/backups` | List backups | Admin+ |
| POST | `/api/servers/:id/backups` | Create backup | Admin+ |
| PATCH | `/api/servers/:id/backups/retention` | Update retention setting | Admin+ |
| GET | `/api/servers/:id/backups/:backupId/download` | Download backup | Admin+ |
| POST | `/api/servers/:id/backups/:backupId/restore` | Restore backup | Admin+ |
| DELETE | `/api/servers/:id/backups/:backupId` | Delete backup | Admin+ |

### Files (Protected)

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/servers/:id/files` | List files in directory | Admin+ |
| GET | `/api/servers/:id/files/read` | Read file content | Admin+ |
| PUT | `/api/servers/:id/files/write` | Write file content | Admin+ |
| POST | `/api/servers/:id/files/create` | Create file or folder | Admin+ |
| DELETE | `/api/servers/:id/files/delete` | Delete file or folder | Admin+ |
| PATCH | `/api/servers/:id/files/rename` | Rename file or folder | Admin+ |
| GET | `/api/servers/:id/files/download` | Download file | Admin+ |
| POST | `/api/servers/:id/files/upload` | Upload file | Admin+ |

### Scheduled Tasks (Protected)

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/servers/:id/schedules` | List scheduled tasks | Admin+ |
| GET | `/api/servers/:id/schedules/:taskId` | Get task details | Admin+ |
| POST | `/api/servers/:id/schedules` | Create scheduled task | Admin+ |
| PATCH | `/api/servers/:id/schedules/:taskId` | Update scheduled task | Admin+ |
| POST | `/api/servers/:id/schedules/:taskId/toggle` | Toggle task enabled | Admin+ |
| DELETE | `/api/servers/:id/schedules/:taskId` | Delete scheduled task | Admin+ |

### Server Access (Protected)

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/servers/:id/access` | List access entries | Owner or Admin |
| POST | `/api/servers/:id/access` | Grant access | Owner or Admin |
| PATCH | `/api/servers/:id/access/:accessId` | Update access level | Owner or Admin |
| DELETE | `/api/servers/:id/access/:accessId` | Revoke access | Owner or Admin |
| POST | `/api/servers/:id/access/transfer-ownership` | Transfer ownership | Owner |

### Users (Protected)

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/users` | List all users | `users.view` |
| GET | `/api/users/:id` | Get user details | `users.view` |
| POST | `/api/users` | Create user | `users.create` |
| PATCH | `/api/users/:id` | Update user | `users.edit` |
| DELETE | `/api/users/:id` | Delete user | `users.delete` |

### Roles (Protected)

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/roles` | List all roles | `roles.view` |
| GET | `/api/roles/:id` | Get role details | `roles.view` |
| POST | `/api/roles` | Create role | `roles.create` |
| PATCH | `/api/roles/:id` | Update role | `roles.edit` |
| DELETE | `/api/roles/:id` | Delete role | `roles.delete` |

### WebSocket Events

```typescript
// Subscribe to server updates
socket.emit('subscribe:server', { serverId: string });

// Server events
socket.on('server:status', ({ serverId, status }) => {});
socket.on('server:log', ({ serverId, line, timestamp }) => {});

// Hytale download events
socket.on('hytale:download:progress', ({ serverId, status, message, authUrl }) => {});
socket.on('hytale:download:log', ({ serverId, line, timestamp }) => {});
```

## Configuration

### Server Paths

By default, game servers are installed to:
- **Windows:** `C:\DeployyServers\{server-name}`
- **Linux:** `/opt/deployy/servers/{server-name}`

### Environment Variables

Create a `.env` file in `packages/backend/` (see `.env.example`):

```env
DATABASE_URL="file:./dev.db"
PORT=3000
NODE_ENV=development
FRONTEND_URL="http://localhost:5173"
SERVERS_BASE_PATH="C:\\DeployyServers"
JWT_SECRET="your-secret-key-minimum-32-characters"
JWT_EXPIRATION="24h"
```

**Important:** Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Authentication

Deployy Panel uses JWT-based authentication with HTTP-only cookies for security.

### Initial Setup

On first run, you'll be redirected to create an admin account. The first registered user automatically gets the Admin role with full access.

### Security Features

- Passwords hashed with bcrypt (14 rounds)
- JWT tokens stored in HTTP-only cookies (not accessible via JavaScript)
- 24-hour token expiration
- Rate limiting on auth endpoints (5 requests per 15 minutes)
- All API routes and WebSocket connections require authentication

## Roles & Permissions

Deployy Panel has a two-tier permission system:

### Panel Permissions (Role-based)

Roles grant panel-wide permissions. Default roles:

| Role | Permissions |
|------|-------------|
| **Admin** | Full access (`panel.admin`) |
| **Moderator** | View all servers, view users |
| **User** | No special permissions (only own servers) |

Available panel permissions:
- `panel.admin` - Full access, bypasses all permission checks
- `servers.create` - Create new servers
- `servers.viewAll` - View all servers (not just own)
- `users.view`, `users.create`, `users.edit`, `users.delete` - User management
- `roles.view`, `roles.create`, `roles.edit`, `roles.delete` - Role management

### Server Permissions (Per-server)

Each user can have a different permission level per server:

| Level | Capabilities |
|-------|--------------|
| **Owner** | Full control, can delete, manage access, transfer ownership |
| **Admin** | Manage settings, files, backups |
| **Operator** | Start, stop, restart, send commands |
| **Viewer** | View console and logs only |

When you create a server, you automatically become its owner.

### Admin UI

Users with appropriate permissions can access the admin section at `/admin`:
- **Users page** - Manage user accounts and role assignments
- **Roles page** - View and manage custom roles (system roles are protected)

## Dynamic Server Settings

The Settings tab on each server page provides a fully dynamic configuration editor:

- **Auto-generated UI** - Reads the server's `config.json` and generates form fields automatically
- **Smart type detection** - Booleans show toggles, numbers show number inputs, strings show text inputs
- **Nested objects** - Displayed as collapsible sections for complex configurations
- **Arrays** - Add/remove items dynamically with appropriate field types
- **No hardcoding** - New config options appear automatically when games add them
- **Restart warning** - Shows alert when server is running and changes require restart
- **Permission required** - Only users with Admin or Owner server access can edit settings

This means when Hytale or other games update their config format, the UI adapts automatically without code changes.

## Backup System

The Backups tab on each server page provides comprehensive backup management:

- **Create Backups** - Zip the entire server directory (excluding the backups folder itself)
- **Restore Backups** - Extract a backup to restore server state (server must be stopped)
- **Download Backups** - Download backup files as zip archives
- **Delete Backups** - Remove old backups manually
- **Retention Policy** - Configure how many backups to keep (e.g., keep last 5, auto-delete older)
- **Backup Location** - Backups stored in `server_path/backups/`
- **Permission Required** - Only users with Admin or Owner server access can manage backups

## File Manager

The Files tab on each server page provides a full-featured file manager:

- **Browse Files** - Navigate through server directories with breadcrumb navigation
- **Edit Files** - Built-in Monaco Editor (VSCode's editor) with syntax highlighting for JSON, YAML, properties, logs, and more
- **Create Files/Folders** - Create new files or directories
- **Rename** - Rename files and folders
- **Delete** - Delete files and folders with confirmation dialog
- **Upload** - Upload files via button or drag & drop
- **Download** - Download any file directly
- **Binary Protection** - Binary files (.jar, .exe, .zip, etc.) are blocked from editing but can be downloaded
- **Path Security** - All operations are validated to prevent path traversal attacks
- **Permission Required** - Only users with Admin or Owner server access can manage files

## Scheduled Tasks

The Schedules tab on each server page provides automated task scheduling:

- **Auto-Restart** - Schedule automatic server restarts at intervals (hourly, daily, weekly)
- **Scheduled Backups** - Automate backup creation on a regular schedule
- **Custom Commands** - Execute server commands automatically (e.g., warning messages before restart)
- **Enable/Disable** - Toggle tasks on and off without deleting them
- **Multiple Schedules** - Create multiple tasks with different schedules per server
- **Last Run Tracking** - See when each task last executed and when it will run next
- **Permission Required** - Only users with Admin or Owner server access can manage schedules

### Available Schedules

| Schedule | Description |
|----------|-------------|
| Every hour | Runs at the top of each hour |
| Every 3 hours | Runs at 0:00, 3:00, 6:00, etc. |
| Every 6 hours | Runs at 0:00, 6:00, 12:00, 18:00 |
| Every 12 hours | Runs at 0:00 and 12:00 |
| Daily at midnight | Runs at 00:00 every day |
| Daily at 3:00 AM | Runs at 03:00 every day |
| Daily at 6:00 AM | Runs at 06:00 every day |
| Daily at noon | Runs at 12:00 every day |
| Daily at 6:00 PM | Runs at 18:00 every day |
| Weekly on Sunday | Runs at midnight every Sunday |
| Weekly on Monday | Runs at midnight every Monday |

## Hytale Server Auto-Download

When creating a new Hytale server, you can enable automatic download of server files:

1. **Check "Auto-download server files"** when creating a new Hytale server
2. After clicking Create, a download modal appears showing real-time progress
3. The panel downloads the official Hytale downloader tool
4. **OAuth Authentication** - Click the "Authenticate" button when prompted to sign in with your Hytale account
5. After authentication, server files are automatically downloaded and extracted
6. Temporary files are cleaned up automatically

The download includes:
- `HytaleServer.jar` - The server executable
- `Assets.zip` - Game assets required for the server
- `config.json` - Default server configuration

## Supported Games

| Game | Status | Notes |
|------|--------|-------|
| Hytale | Active | Full support with auto-download |
| Minecraft | Planned | Coming soon |

## Development

### Available Scripts

```bash
# Root level
pnpm dev          # Start all packages in dev mode
pnpm build        # Build all packages
pnpm lint         # Lint all packages
pnpm typecheck    # Type check all packages

# Package level
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm lint         # Run ESLint
```

### Adding a New Game Adapter

1. Create adapter in `packages/backend/src/adapters/`
2. Extend `BaseAdapter` class
3. Implement required methods: `install()`, `start()`, `stop()`, `restart()`
4. Register in `AdapterFactory`

## Roadmap

- [x] User authentication
- [x] Multi-user support with roles & permissions
- [x] Dynamic server settings editor
- [x] Backup system
- [x] File Manager - Browse, edit, upload, and download server files with Monaco Editor
- [x] Scheduled Tasks - Auto-restart, scheduled backups, and custom commands with cron scheduling
- [x] Hytale Server Auto-Download - Automatically download server files during setup with OAuth
- [ ] Panel Self-Updater - Check for new versions and one-click update
- [ ] Hytale Server Updater - Check for and apply Hytale server updates
- [ ] Mod manager
- [ ] Minecraft Support - Adapter for Minecraft servers (Paper, Spigot, Fabric)
- [ ] Docker Support - One-command deployment with Docker Compose

## License

AGPL-3.0

## Links

- **Issues:** [GitHub Issues](https://github.com/MillerSpil/Deployy-Panel/issues)
