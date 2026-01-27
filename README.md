<p align="center">
  <img src="docs/logo.svg" alt="Deployy Panel" width="128" height="128">
</p>

<h1 align="center">Deployy Panel</h1>

<p align="center">
  Open-source, extensible game server management panel.<br>
  Currently supporting Hytale, with more games coming soon.
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#screenshots">Screenshots</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#installation">Installation</a> •
  <a href="#production-deployment">Production</a> •
  <a href="#security">Security</a>
</p>

---

## Features

- **Multi-Server Management** - Create and manage multiple game servers from a single dashboard
- **Real-Time Console** - Live server logs with ANSI color support and command input
- **File Manager** - Browse, edit, upload, and download server files with Monaco Editor
- **Backup System** - Create, restore, and manage backups with retention policies
- **Scheduled Tasks** - Automate restarts, backups, and commands with cron scheduling
- **Dynamic Settings** - Auto-generated config editor based on server's JSON config
- **Roles & Permissions** - Panel-wide roles and per-server access levels
- **Multi-User Support** - Multiple users with different roles
- **Game Adapters** - Extensible architecture for adding new game support
- **Self-Updater** - One-click updates from GitHub releases
- **Cross-Platform** - Windows and Linux support
- **Docker Support** - One-command deployment

### Supported Games

| Game | Status |
|------|--------|
| Hytale | Supported (with auto-download) |
| Minecraft | Planned |

---

## Screenshots

<details>
<summary>Click to view screenshots</summary>

### Login
![Login](docs/screenshots/login.png)

### Dashboard
![Dashboard](docs/screenshots/dashboard-servers.png)

### Server Console
![Console](docs/screenshots/server-view-console.png)

### File Manager
![Files](docs/screenshots/file-manager.png)

### Server Settings
![Settings](docs/screenshots/server-settings.png)

### Server Creation
![Create Server](docs/screenshots/server-creation.png)

</details>

---

## Requirements

- **Node.js** 20+
- **pnpm** 8+
- **Java** 25+ (for Hytale servers - [Adoptium](https://adoptium.net/) recommended)

---

## Quick Start

```bash
git clone https://github.com/MillerSpil/Deployy-Panel.git
cd Deployy-Panel
pnpm install

# Build shared package (required before running)
pnpm --filter @deployy/shared build

# Setup backend
cd packages/backend
cp .env.example .env
# Edit .env and set JWT_SECRET (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

pnpm prisma generate
pnpm prisma db push
pnpm prisma db seed

# Development (run in separate terminals)
# Terminal 1 - Backend:
pnpm dev

# Terminal 2 - Frontend:
cd ../frontend
pnpm dev

# Open http://localhost:5173
```

---

## Installation

<details>
<summary><strong>Docker (Recommended for Production)</strong></summary>

```bash
# Clone the repository
git clone https://github.com/MillerSpil/Deployy-Panel.git
cd Deployy-Panel

# Create environment file
cp packages/backend/.env.example .env

# Generate a secure JWT secret and add to .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Edit .env and set JWT_SECRET to the generated value
# Also set NODE_ENV=production

# Build and start
docker build -t deployy-panel .
docker compose up -d
```

The panel will be available at `http://localhost:3000`

**Configuration:**
- Data persisted to `./data` directory
- Database at `/data/deployy.db`

**Commands:**
```bash
docker compose logs -f      # View logs
docker compose down         # Stop
docker compose up -d        # Start
docker build -t deployy-panel . --no-cache && docker compose up -d  # Rebuild
```

</details>

<details>
<summary><strong>Manual Installation (Self-Hosted)</strong></summary>

```bash
# Clone and install dependencies
git clone https://github.com/MillerSpil/Deployy-Panel.git
cd Deployy-Panel
pnpm install

# Setup backend
cd packages/backend
cp .env.example .env
# Edit .env - set a secure JWT_SECRET (minimum 32 characters)

# Initialize database
pnpm prisma generate
pnpm prisma db push
pnpm prisma db seed

# Build frontend
cd ../frontend
pnpm build

# Build backend
cd ../backend
pnpm build

# Start production server
NODE_ENV=production node dist/index.js
```

The panel serves at `http://localhost:3000`

</details>

<details>
<summary><strong>Development Setup</strong></summary>

```bash
# Clone and install
git clone https://github.com/MillerSpil/Deployy-Panel.git
cd Deployy-Panel
pnpm install

# Setup backend
cd packages/backend
cp .env.example .env
# Edit .env - set JWT_SECRET (can use any string for dev)

# Initialize database
pnpm prisma generate
pnpm prisma db push
pnpm prisma db seed
```

Run in two terminals:

```bash
# Terminal 1 - Backend (port 3000)
cd packages/backend
pnpm dev

# Terminal 2 - Frontend (port 5173)
cd packages/frontend
pnpm dev
```

Open `http://localhost:5173`

</details>

---

## Production Deployment

For exposing Deployy Panel to the internet, you need HTTPS and a reverse proxy.

<details>
<summary><strong>Windows - Caddy (Recommended)</strong></summary>

Caddy automatically handles SSL certificates.

1. **Download Caddy** from https://caddyserver.com/download (Windows amd64)

2. **Create `Caddyfile`** in the same folder:
```
panel.yourdomain.com {
    reverse_proxy localhost:3000
}
```

3. **Run Caddy:**
```powershell
.\caddy.exe run
```

4. **Run as Windows Service (optional):**
```powershell
.\caddy.exe install
.\caddy.exe start
```

</details>

<details>
<summary><strong>Windows - Firewall</strong></summary>

```powershell
# Allow Hytale game server (UDP)
New-NetFirewallRule -DisplayName "Hytale Server" -Direction Inbound -Protocol UDP -LocalPort 5520 -Action Allow

# Allow HTTP/HTTPS
New-NetFirewallRule -DisplayName "HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

</details>

<details>
<summary><strong>Linux - Caddy (Recommended)</strong></summary>

1. **Install Caddy** - https://caddyserver.com/docs/install

2. **Create Caddyfile:**
```
panel.yourdomain.com {
    reverse_proxy localhost:3000
}
```

3. **Start Caddy:**
```bash
sudo systemctl enable --now caddy
```

</details>

<details>
<summary><strong>Linux - Nginx + Certbot</strong></summary>

1. **Install:**
```bash
sudo apt install nginx certbot python3-certbot-nginx
```

2. **Create config** (`/etc/nginx/sites-available/deployy`):
```nginx
server {
    listen 80;
    server_name panel.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

3. **Enable and get SSL:**
```bash
sudo ln -s /etc/nginx/sites-available/deployy /etc/nginx/sites-enabled/
sudo certbot --nginx -d panel.yourdomain.com
sudo systemctl restart nginx
```

</details>

<details>
<summary><strong>Linux - Firewall (UFW)</strong></summary>

```bash
sudo ufw allow 5520/udp  # Hytale game server
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
```

</details>

**After Setup:** Update your `.env`:
```env
NODE_ENV=production
FRONTEND_URL="https://panel.yourdomain.com"
```

---

## Configuration

<details>
<summary><strong>Environment Variables</strong></summary>

Create `.env` in `packages/backend/` (or project root for Docker):

```env
# Database
DATABASE_URL="file:./dev.db"

# Server
PORT=3000
NODE_ENV=development

# Frontend URL (dev only - for CORS)
FRONTEND_URL="http://localhost:5173"

# Game server storage location
SERVERS_BASE_PATH="C:\\DeployyServers"  # Windows
# SERVERS_BASE_PATH="/opt/deployy/servers"  # Linux

# Authentication (REQUIRED)
JWT_SECRET="your-secret-key-minimum-32-characters-here"
JWT_EXPIRATION="24h"
```

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

</details>

<details>
<summary><strong>Server Storage Paths</strong></summary>

Game servers are installed to:
- **Windows:** `C:\DeployyServers\{server-name}`
- **Linux:** `/opt/deployy/servers/{server-name}`

Change with `SERVERS_BASE_PATH` in your `.env` file.

</details>

---

## First-Time Setup

1. Open the panel in your browser
2. Create an admin account (first user gets Admin role)
3. Create a Hytale server with "Auto-download server files" enabled
4. Authenticate with your Hytale account when prompted

---

## Hytale Server Management

<details>
<summary><strong>Creating a Server</strong></summary>

1. Click "Create Server" on the dashboard
2. Enter server name and port (default: 5520)
3. Enable "Auto-download server files"
4. Authenticate with your Hytale account
5. Server files download automatically

</details>

<details>
<summary><strong>Updating a Server</strong></summary>

1. Navigate to server's "Updates" tab
2. Stop the server if running
3. Click "Update Server"
4. Authenticate when prompted

</details>

<details>
<summary><strong>Server Requirements</strong></summary>

- Java 25+ (Hytale uses modern Java features)
- 6-8GB RAM recommended
- UDP port 5520 (Hytale uses QUIC protocol)

</details>

---

## Permissions

<details>
<summary><strong>Panel Roles</strong></summary>

| Role | Access |
|------|--------|
| **Admin** | Full access to everything |
| **Moderator** | View all servers, view users |
| **User** | Only access to own servers |

</details>

<details>
<summary><strong>Server Access Levels</strong></summary>

| Level | Capabilities |
|-------|-------------|
| **Owner** | Full control, delete, manage access |
| **Admin** | Settings, files, backups |
| **Operator** | Start, stop, restart, commands |
| **Viewer** | View console only |

</details>

---

## Security

- JWT tokens in HTTP-only cookies
- Passwords hashed with bcrypt (14 rounds)
- 24-hour token expiration
- Rate limiting on auth endpoints

<details>
<summary><strong>Rate Limits</strong></summary>

- Auth endpoints: 5 requests per 15 minutes
- File operations: 30 requests per minute
- Backup operations: 10 requests per minute

</details>

<details>
<summary><strong>Security Checklist (Public Deployments)</strong></summary>

- [ ] Strong JWT_SECRET (64+ character random string)
- [ ] HTTPS enabled via reverse proxy
- [ ] Firewall configured (only expose necessary ports)
- [ ] Regular backups enabled
- [ ] Keep panel updated

</details>

---

## Development

<details>
<summary><strong>Scripts</strong></summary>

```bash
pnpm dev          # Start all in dev mode
pnpm build        # Build all packages
pnpm lint         # Lint all packages
```

</details>

<details>
<summary><strong>Tech Stack</strong></summary>

- **Frontend:** React 18, TypeScript, Tailwind CSS, Vite, Socket.IO
- **Backend:** Node.js, Express, Prisma (SQLite), Socket.IO, Zod
- **Monorepo:** pnpm workspaces

</details>

<details>
<summary><strong>Project Structure</strong></summary>

```
Deployy-Panel/
├── packages/
│   ├── backend/          # Express API server
│   │   ├── src/
│   │   │   ├── adapters/     # Game adapters
│   │   │   ├── routes/       # API endpoints
│   │   │   ├── services/     # Business logic
│   │   │   └── websocket/    # Socket.IO handlers
│   │   └── prisma/           # Database schema
│   │
│   ├── frontend/         # React web app
│   │   └── src/
│   │       ├── components/
│   │       ├── pages/
│   │       └── hooks/
│   │
│   └── shared/           # Shared TypeScript types
│
├── docs/                 # Screenshots and assets
├── docker-compose.yml
├── Dockerfile
└── package.json
```

</details>

<details>
<summary><strong>Adding Game Support</strong></summary>

The panel uses an adapter pattern. To add a new game:

1. Create adapter in `packages/backend/src/adapters/`
2. Extend `BaseAdapter` class
3. Implement: `install()`, `start()`, `stop()`, `restart()`
4. Register in `AdapterFactory`

</details>

---

## Troubleshooting

<details>
<summary><strong>"Invalid JWT secret"</strong></summary>

Your JWT_SECRET is too short or not set. Generate one:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

</details>

<details>
<summary><strong>Server won't start</strong></summary>

- Check Java 25+ is installed: `java -version`
- Ensure the port isn't in use
- Check server logs in the console tab

</details>

<details>
<summary><strong>Can't connect to game server</strong></summary>

- Hytale uses UDP port 5520, not TCP
- Check your firewall allows UDP traffic
- Verify the port in server settings

</details>

<details>
<summary><strong>Database errors</strong></summary>

```bash
cd packages/backend
pnpm prisma db push
pnpm prisma db seed
```

</details>

---

## License

AGPL-3.0 - See [LICENSE](LICENSE)

---

## Links

- [GitHub Issues](https://github.com/MillerSpil/Deployy-Panel/issues)
- [Hytale](https://hytale.com)
