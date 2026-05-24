# Submission Packaging Notes

Date: 2026-05-24

## Recommendation

Submit a source-code zip, not a newly built `.exe`.

The current project is a TypeScript monorepo with a Vue/PixiJS frontend and a Fastify backend. It does not already include Electron, Tauri, `pkg`, or `nexe` configuration. Building a reliable Windows executable in the final hour would require adding a desktop shell, bundling or launching the backend, handling native SQLite/libsql dependencies, and retesting the full LLM flow.

The measured source archive created from Git is about 2.5 MB, far below the 100 MB submission limit.

## What to exclude from the submission zip

- `node_modules/`
- `.git/`
- `.claude/`
- `.codex-logs/`
- `.env` and any real API keys
- local SQLite database files under `apps/server/*.db`
- Playwright reports and test result folders

## Recommended run instructions

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

The live LLM demo requires local environment variables:

```text
OPENAI_API_KEY=<local key>
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=deepseek/deepseek-chat
```

Do not commit the real key to the repository. If the instructor needs to run the LLM path, provide the key separately or configure it only on the demo machine.

## Current checked package size

Command used:

```powershell
git archive --format=zip -o C:\Users\He\Desktop\GAMEDESIGN\PROJECT\IslandEscape-source-current.zip HEAD
```

Observed size before the final report polish commit: about 3 MB after the report PDF and figures were included.
