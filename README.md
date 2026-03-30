# FinalProject Developer Guide

This repository is a pnpm workspace monorepo for a turn-based text game:
- `apps/web`: Vue 3 + TypeScript + Vite + Pinia + Vue Router + Tailwind CSS v4
- `apps/server`: Fastify + Zod + @openai/agents + Drizzle + SQLite(file)
- `packages/shared`: shared schemas and contract types used by both web and server

## 1. Requirements

- Node.js: LTS recommended, `>= 22.12`
- npm: `>= 10`
- Git: any stable version
- Package manager: pnpm via Corepack (do not use standalone install scripts)

## 2. Fresh Setup (Windows)

### 2.1 Install base tools

1. Install Git
2. Install Node.js LTS (scoop is fine)
3. Install VS Code (recommended)

### 2.2 Enable pnpm (required order)

Run in PowerShell:

```powershell
npm install -g corepack@latest
corepack enable pnpm
corepack use pnpm@latest-10
```

### 2.3 Clone and initialize

```powershell
git clone <your-repo-url> FinalProject
cd FinalProject
git init
pnpm install
```

## 3. Fresh Setup (macOS)

### 3.1 Install base tools

1. Install Xcode Command Line Tools

```bash
xcode-select --install
```

2. Install Homebrew (if missing)
3. Install Git and Node.js LTS with Homebrew

```bash
brew install git node
```

4. Install VS Code (optional)

### 3.2 Enable pnpm (required order)

```bash
npm install -g corepack@latest
corepack enable pnpm
corepack use pnpm@latest-10
```

### 3.3 Clone and initialize

```bash
git clone <your-repo-url> FinalProject
cd FinalProject
git init
pnpm install
```

## 4. Environment Variables

Create local env file from template:

```bash
cp .env.example .env
```

PowerShell equivalent:

```powershell
Copy-Item .env.example .env
```

Supported variables:
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `DB_FILE_NAME` (default: `file:local.db`)
- `LOG_LEVEL`

## 5. Common Commands

Run from repository root.

### 5.1 Start local development

```bash
pnpm dev
```

### 5.2 Build

```bash
pnpm build
```

### 5.3 Lint and type-check

```bash
pnpm lint
pnpm typecheck
```

### 5.4 Test

```bash
pnpm test
pnpm test:unit
pnpm test:e2e
```

Install Playwright browsers before first e2e run:

```bash
pnpm --filter @game/web exec playwright install
```

### 5.5 Database commands

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:studio
```

## 6. Release Flow (Recommended)

This repo is currently `private`, so release means project delivery, not npm publishing.

Recommended process:

1. Sync with main and install dependencies
```bash
git checkout main
git pull
pnpm install
```

2. Run quality gates
```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

3. Build artifacts
- Web artifact: `apps/web/dist`
- Server artifact: `apps/server/dist`

4. Tag release
```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

5. Deploy
- Deploy static web artifact from `apps/web/dist`
- Deploy Node server from `apps/server/dist` with `.env`

## 7. Editor Baseline

Recommended VS Code extensions:
- Vue - Official (Volar)
- ESLint
- Tailwind CSS IntelliSense
- Playwright Test

Disable Vetur.

## 8. Repository Layout

```text
.
├─ apps
│  ├─ web
│  └─ server
├─ packages
│  └─ shared
├─ package.json
├─ pnpm-workspace.yaml
└─ tsconfig.base.json
```

## 9. Language Policy

- All project documentation must be written in English.
- All code comments must be written in English.

## 10. Core Constraints

- v1 transport is REST + SSE only. Do not add WebSocket in v1.
- Agent runtime is allowed only in `apps/server`.
- Frontend must not store or expose model keys.
- Data layer is fixed to Drizzle + @libsql/client + SQLite(file).
- Do not introduce heavy UI libraries such as Element Plus, Naive UI, or Vuetify.
