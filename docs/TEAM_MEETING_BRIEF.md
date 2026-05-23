# Island Escape Team Meeting Brief

Use this as the meeting agenda and final-submission checklist.

## Current Status

- The project runs locally with `pnpm dev`.
- Frontend URL: `http://localhost:5173/`
- Backend URL: `http://127.0.0.1:8787`
- The current game is a 2D pixel-art survival trading game with LLM-powered NPC agents.
- The player can start a game, enter the island map, move with keyboard controls, labor, trade, and end the turn.
- OpenRouter is configured locally through `.env`; do not commit `.env`.
- A verified AI day-cycle smoke test completed: new game, player fishes, player ends turn, AI turns finish, and the game returns to Day 2.

## Demo Script

1. Start the app:

   ```bash
   pnpm dev
   ```

2. Open `http://localhost:5173/`.
3. Click `NEW GAME`.
4. Show the island map, HUD, player resources, trade slots, merchant prices, and Event Log.
5. Move with `WASD` or arrow keys.
6. Walk near a fishing spot or farmland and press `E`.
7. Choose the labor action.
8. Walk near the merchant ship or an NPC and press `E`.
9. Show the trade phase UI.
10. Click `End Turn`.
11. Let the AI agents finish their turn and show that the game advances to the next day.

## Verified Quality Gates

Run these before final submission:

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

Manual checks:

- Start screen loads.
- `NEW GAME` enters the island.
- Canvas is not blank.
- HUD shows day, phase, fish, wheat, coins, trade slots, ship prices, and escape progress.
- Keyboard movement works.
- `E` opens interaction menus.
- Labor happens before trading.
- End Turn runs AI turns and returns to the next player day.
- Event Log shows important game events.

## Remaining Work Before Final Submission

### Must Have

- Record a short demo video or collect final screenshots.
- Do one full manual playtest with the real OpenRouter key.
- Confirm no key or `.env` file is staged before committing.
- Finalize the report and presentation.
- Run the full quality-gate command list once immediately before the final commit.

### Should Have

- Add one short section in the report explaining the LLM agent design.
- Add one short section explaining server-authoritative state and SSE updates.
- Add one short section explaining testing evidence.
- Add a short limitations section instead of trying to finish every optional feature.

### Deferred

- Save/load UI.
- Random daily events.
- Sound effects.
- Mobile touch support.
- Real sprite-sheet art.
- Multiplayer.
- Replay system.

## Suggested Team Assignments

### Owner 1: Demo and Manual QA

Responsibilities:

- Run the app locally.
- Execute the demo script.
- Test movement, labor, merchant trade, NPC negotiation, and End Turn.
- Record any bug with exact steps and screenshot/video evidence.

Deliverables:

- A 1-2 minute demo path.
- A manual QA checklist with pass/fail notes.
- Final screenshots or screen recording.

### Owner 2: Final Report and Presentation

Responsibilities:

- Write the final report.
- Explain game concept, rules, architecture, AI agents, and testing.
- Insert screenshots from `docs/screenshots/`.
- Prepare presentation slides or speaking notes.

Deliverables:

- Final report draft.
- Presentation outline.
- A short limitations/future-work section.

### Current Code Owner

Responsibilities:

- Keep the codebase passing quality gates.
- Confirm OpenRouter configuration works locally.
- Make final commit after reviewing staged files.
- Coordinate bug fixes from the manual QA pass.

Deliverables:

- Final passing validation log.
- Clean commit with no secrets.
- Final merge/submission package.

## Risks to Mention Honestly

- LLM calls depend on the configured OpenRouter key and network.
- AI turns can take several seconds because NPC decisions run sequentially.
- The project currently prioritizes a stable desktop browser experience.
- Optional features such as save/load UI and random events are intentionally deferred.

## Commit Safety Checklist

Before committing:

```bash
git status --short
git diff --check
```

Confirm:

- `.env` is not staged.
- `.DS_Store` is not staged.
- Generated reports, screenshots, and docs are intentional.
- The final diff does not contain API keys, tokens, cookies, or passwords.
