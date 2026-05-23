# Agent Constraints and Project Rules

This document defines project boundaries, API contracts, and engineering rules for human contributors and automated coding agents.

## 1. Project Scope

- Type: `pnpm workspace` monorepo
- Goal: 2D pixel-art survival trading game with LLM-powered NPC agents
- Architecture: `Vue + PixiJS frontend + Fastify API/SSE + Shared Zod Contracts + SQLite`
- Current player flow: start game, move on the island, labor first, trade second, then end turn to trigger AI turns

## 2. Directory Ownership

- `apps/web`
  - Vue UI, PixiJS rendering, keyboard interaction, HUD, dialogue, action menu, event log
  - Must not access model SDK keys directly
- `apps/server`
  - Game engine, API routes, SSE output, SQLite persistence, LLM decision and negotiation calls
  - All model/provider runtime code must live here
- `packages/shared`
  - Shared Zod schemas and cross-package types
  - API payloads must stay aligned with these schemas

## 3. Communication Contract

Current transport:

- Player commands: REST
- Runtime updates: SSE
- Not allowed without explicit agreement: WebSocket or frontend-side model calls

Current endpoints:

- `POST /api/games`
- `GET /api/games/:id`
- `POST /api/games/:id/action`
- `GET /api/games/:id/stream`

Current player actions:

- `fish`
- `farm`
- `trade_merchant`
- `trade_peer`
- `negotiate_reply`
- `end_turn`

Current SSE event types:

- `state_update`
- `ai_thinking`
- `ai_decision`
- `negotiation`
- `trade_result`
- `settlement`
- `elimination`
- `escape`
- `game_over`
- `day_start`
- `log`
- `error`

## 4. Data and State Rules

- Storage stack is fixed to `Drizzle + @libsql/client + SQLite(file)`
- Do not replace the primary data layer with Prisma
- The server is the source of truth for game state
- The frontend may keep UI state, but it must not mutate authoritative game state directly
- Game rules belong in `apps/server/src/engine/game.ts`
- Shared API contracts belong in `packages/shared/src/index.ts`

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
- Do not commit `.env`, real keys, tokens, cookies, or passwords

## 6. Frontend Constraints

Required stack:

- Vue 3
- TypeScript
- Vite
- Pinia
- Vue Router
- Tailwind CSS v4
- PixiJS

UI policy:

- Keep the first screen as the playable game entry, not a marketing page
- Keep the 2D island map and character movement as the primary experience
- Do not regress to a dashboard or text-only interface
- Do not introduce heavy component libraries unless explicitly approved

## 7. AI Agent Constraints

- NPC decisions must stay server-side
- Prefer OpenAI-compatible providers configured through `.env`
- Current default model target is `deepseek/deepseek-chat`
- Do not use provider-specific JSON response features unless the configured provider supports them
- If LLM calls fail, preserve gameplay stability and log the failure clearly

## 8. Language Policy

- Project documentation should be written in English
- Code comments should be written in English
- User-facing game text may remain English unless the team decides otherwise

## 9. Quality Gates

Before final submission, run:

```bash
pnpm --filter @game/web exec oxlint .
pnpm --filter @game/web exec eslint . --cache=false
pnpm typecheck
pnpm --filter @game/shared test:unit
pnpm --filter @game/server test:unit
pnpm --filter @game/web test:unit -- --run
pnpm --filter @game/web test:e2e -- --project=chromium
pnpm build
```

Also manually verify:

- Start screen renders
- `NEW GAME` enters the island map
- WASD movement works
- `E` opens the correct interaction menu near fish, farm, NPCs, and ship
- Labor first, then trade flow works
- End turn runs AI turns without authentication or provider errors
- Event Log shows day start, player action, AI, settlement, and errors clearly

## 10. Agent Editing Behavior

- Prefer minimal, focused edits
- Update `packages/shared` schemas when API contracts change
- Update tests when data contracts change
- Keep docs, scripts, and implementation aligned
- Do not delete or overwrite user changes without explicit instruction
- Do not reintroduce the old `/api/runs` text-game contract

## 11. Review Checklist

Before submitting changes, verify:

- REST + SSE contract matches current `/api/games` implementation
- Frontend has no access to secrets or agent runtime
- Shared schemas are not bypassed
- No forbidden dependencies were introduced
- Root scripts still work as expected
- README, DEVELOPER guide, and this file describe the same game
