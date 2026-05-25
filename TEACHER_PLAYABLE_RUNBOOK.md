# Island Escape: Teacher Playable Runbook

This package is the playable source build of Island Escape. It intentionally
does not include `node_modules`, `.env`, reports, slides, videos, or local logs.

## Requirements

- Node.js 22.12 or newer
- pnpm through Corepack
- An OpenAI-compatible API key. The default example is OpenRouter with
  `deepseek/deepseek-chat`.

## Quick Start

```bash
corepack enable pnpm
corepack use pnpm@latest-10
pnpm install
cp .env.example .env
pnpm dev
```

Then open:

- Game: http://localhost:5173
- Backend health/API base: http://localhost:8787

Before running `pnpm dev`, edit `.env` and set:

```text
OPENAI_API_KEY=<your-openrouter-or-openai-key>
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=deepseek/deepseek-chat
DB_FILE_NAME=file:local.db
LOG_LEVEL=info
```

## What To Try First

1. Click `NEW GAME`.
2. Move with `WASD`.
3. Press `E` near a fishing spot, farm plot, NPC, merchant ship, or dungeon.
4. Labor first: fish or farm.
5. Talk to one NPC and send a short message.
6. End the turn and watch the AI agents act.
7. If trade phase and resources allow it, enter the dungeon and try the boss
   fight with `WASD`, `Space`, and `Q`.

## Troubleshooting

- If `NEW GAME` fails, confirm the backend is running on port `8787`.
- If NPC dialogue is slow, it is waiting for the external model API.
- If AI calls fail, check `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and
  `OPENAI_MODEL` in `.env`.
- If port `5173` or `8787` is already used, stop the old process and rerun
  `pnpm dev`.
- If the browser shows an old version, hard refresh the page after restarting
  the dev server.

## Validation Commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The final source package was prepared to be small and reproducible. Dependencies
are restored by `pnpm install` from `pnpm-lock.yaml`.
