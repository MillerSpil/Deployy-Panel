# Deployy Panel

Open-source, multi-game server management platform. Start with Hytale, expand to Minecraft and beyond.

## Features

- **Multi-Server Management** - Create and manage multiple game servers from a single dashboard
- **Dynamic Server Settings** - Auto-generated config editor based on each game's JSON config
- **Backup System** - Create, restore, and manage backups with configurable retention policies
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
git clone https://github.com/YOUR_USERNAME/deployy-panel.git
cd deployy-panel
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
deployy-panel/
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

### Backups (Protected)

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/servers/:id/backups` | List backups | Admin+ |
| POST | `/api/servers/:id/backups` | Create backup | Admin+ |
| PATCH | `/api/servers/:id/backups/retention` | Update retention setting | Admin+ |
| GET | `/api/servers/:id/backups/:backupId/download` | Download backup | Admin+ |
| POST | `/api/servers/:id/backups/:backupId/restore` | Restore backup | Admin+ |
| DELETE | `/api/servers/:id/backups/:backupId` | Delete backup | Admin+ |

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

## Supported Games

| Game | Status | Notes |
|------|--------|-------|
| Hytale | Active | Full support |
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
- [ ] File Manager - Browse, edit, upload, and delete server files from the panel
- [ ] Scheduled Tasks - Auto-restart, scheduled backups, and other automated tasks
- [ ] Panel Self-Updater - Check for new versions and one-click update
- [ ] Hytale Server Auto-Download - Automatically download server files during setup
- [ ] Hytale Server Updater - Check for and apply Hytale server updates
- [ ] Mod manager
- [ ] Minecraft Support - Adapter for Minecraft servers (Paper, Spigot, Fabric)
- [ ] Docker Support - One-command deployment with Docker Compose

## License

AGPL-3.0

## Links

- **Website:** [deployy.io](https://deployy.io)
- **Issues:** [GitHub Issues](https://github.com/YOUR_USERNAME/deployy-panel/issues)
