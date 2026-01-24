# Deployy Panel

Open-source, multi-game server management platform. Start with Hytale, expand to Minecraft and beyond.

## Features

- **Multi-Server Management** - Create and manage multiple game servers from a single dashboard
- **Real-Time Console** - Live server logs with ANSI color support and command input
- **WebSocket Updates** - Instant status updates across all connected clients
- **Secure Authentication** - JWT-based auth with HTTP-only cookies, bcrypt password hashing
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
```

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

All server endpoints require authentication.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/servers` | List all servers |
| POST | `/api/servers` | Create new server |
| GET | `/api/servers/:id` | Get server details |
| DELETE | `/api/servers/:id` | Delete server |
| POST | `/api/servers/:id/start` | Start server |
| POST | `/api/servers/:id/stop` | Stop server |
| POST | `/api/servers/:id/restart` | Restart server |
| POST | `/api/servers/:id/command` | Send console command |

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

On first run, you'll be redirected to create an admin account. This is a single-user application - only one account can be registered.

### Security Features

- Passwords hashed with bcrypt (14 rounds)
- JWT tokens stored in HTTP-only cookies (not accessible via JavaScript)
- 24-hour token expiration
- Rate limiting on auth endpoints (5 requests per 15 minutes)
- All API routes and WebSocket connections require authentication

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
- [ ] Multi-user support
- [ ] Backup system
- [ ] Mod manager
- [ ] Minecraft support
- [ ] Docker support

## License

AGPL-3.0

## Links

- **Website:** [deployy.io](https://deployy.io)
- **Issues:** [GitHub Issues](https://github.com/YOUR_USERNAME/deployy-panel/issues)
