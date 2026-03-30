# Agent Constraints and Project Rules

This document defines project boundaries, API contracts, and engineering rules for both human contributors and automated coding agents.

## 1. Project Scope

- Type: `pnpm workspace` monorepo
- Goal: turn-based text game with streaming narration, stats changes, and save/load support
- Architecture: `Vue SPA + Node API/SSE + Shared Contracts + SQLite`

## 2. Directory Ownership

- `apps/web`
  - UI, command input, and local session presentation
  - Must not access model SDK keys directly
- `apps/server`
  - Agent orchestration, game logic, SSE output, persistence
  - All model/provider runtime code must live here
- `packages/shared`
  - Shared schemas and cross-package types
  - API payloads should be validated with shared Zod schemas

## 3. Communication Contract

v1 transport is fixed:
- Command submission: REST
- Stream output: SSE
- Not allowed: WebSocket

Required endpoints:
- `POST /api/runs`
- `GET /api/runs/:runId/stream`
- `GET /api/saves`
- `POST /api/saves`
- `GET /api/saves/:id`
- `POST /api/saves/:id/load`

SSE event types:
- `token`
- `agent_step`
- `state_patch`
- `log`
- `completed`
- `error`

## 4. Data and State Rules

- Storage stack is fixed to `Drizzle + @libsql/client + SQLite(file)`
- Do not replace primary data layer with Prisma
- Server is the source of truth for game state
- Frontend state is presentation/session state only

## 5. Security and Secrets

Required environment variables:
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `DB_FILE_NAME`
- `LOG_LEVEL`

Security constraints:
- Secrets are read only on the server side
- Frontend bundles must never include model keys

## 6. Frontend Constraints

Required stack:
- Vue 3 + TypeScript + Vite + Pinia + Vue Router + Tailwind CSS v4

UI policy:
- Do not introduce heavy component libraries (Element Plus, Naive UI, Vuetify)
- Keep the text-game interface flexible and lightweight

## 7. Language Policy

- All project documentation must be written in English.
- All code comments must be written in English.

## 8. Quality Gates

Before merge, all of the following must pass:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

Recommended extra check:

```bash
pnpm build
```

## 9. Agent Editing Behavior

- Prefer minimal, focused edits
- Update `packages/shared` schemas when API contracts change
- Update tests when data contracts change
- Do not add new transport protocols without explicit requirements
- Keep docs, scripts, and implementation aligned

## 10. Review Checklist

Before submitting changes, verify:
- REST + SSE contract is preserved
- Frontend has no access to secrets/agent runtime
- Shared schemas are not bypassed
- No forbidden dependencies were introduced
- Root scripts still work as expected
