FROM node:20-slim

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages ./packages

# Install ALL dependencies (including dev for build)
RUN pnpm install --frozen-lockfile --shamefully-hoist

# Build everything
RUN pnpm --filter @deployy/shared build
RUN pnpm --filter @deployy/backend exec prisma generate
RUN pnpm --filter @deployy/frontend build
RUN pnpm --filter @deployy/backend build

WORKDIR /app/packages/backend

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --skip-generate && npx prisma db seed && node dist/index.js"]
