# Island Escape — Developer Guide

This document explains the codebase architecture, how each part works, and how to make changes. Read this before touching any code.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [How the Game Loop Works](#2-how-the-game-loop-works)
3. [Shared Types (packages/shared)](#3-shared-types)
4. [Game Engine (apps/server/src/engine)](#4-game-engine)
5. [AI Agent System (apps/server/src/agents)](#5-ai-agent-system)
6. [API & SSE (apps/server/src/routes)](#6-api--sse)
7. [Frontend Architecture (apps/web)](#7-frontend-architecture)
8. [PixiJS Game Rendering (apps/web/src/game)](#8-pixijs-game-rendering)
9. [Vue UI Components (apps/web/src/components)](#9-vue-ui-components)
10. [State Management (apps/web/src/stores)](#10-state-management)
11. [Configuration & Environment](#11-configuration--environment)
12. [Common Tasks](#12-common-tasks)
13. [Known Issues & TODOs](#13-known-issues--todos)

---

## 1. Architecture Overview

```
Browser (Vue + PixiJS)                   Server (Fastify + Node)
┌────────────────────────┐               ┌──────────────────────────┐
│                        │               │                          │
│  PixiJS Canvas         │   REST API    │  Game Engine             │
│  (tile map, characters,│ ◄──────────► │  (pure function state    │
│   movement, animation) │               │   machine, no side       │
│                        │   POST        │   effects)               │
│  Vue Overlays          │  /action ──► │                          │
│  (HUD, dialogue panel, │               │  AI Agents               │
│   action menu, log)    │   SSE         │  (DeepSeek LLM calls     │
│                        │ ◄──────────  │   for decisions &         │
│  Pinia Store           │  /stream      │   negotiations)          │
│  (single source of     │               │                          │
│   truth for Vue)       │               │  SQLite (Drizzle)        │
│                        │               │  (game state persistence)│
└────────────────────────┘               └──────────────────────────┘
```

**Key principle**: the server is the source of truth. The frontend never modifies game state directly — it sends actions to the server and receives updated state back.

**Data flow**:
1. Player presses a key → PixiJS InputManager detects it → emits event to Vue
2. Vue component calls `game.submitAction(...)` → POST to `/api/games/:id/action`
3. Server validates action → updates GameState via engine functions → returns new state
4. Frontend updates Pinia store → Vue reactivity updates HUD, PixiJS reads store for rendering
5. During AI turns, server pushes events via SSE → frontend receives them in real time

---

## 2. How the Game Loop Works

Each in-game day has this exact sequence:

```
DAY START
  │
  ├── Generate random merchant prices
  ├── Deliver pending wheat harvests
  ├── Reset everyone's trade slots to 2
  ├── Shuffle AI turn order
  │
  ▼
PLAYER LABOR  (phase: "player_labor")
  │
  ├── Player MUST choose: fish (+3 fish) or farm (+8 wheat in 3 days)
  │   This is mandatory — you cannot skip it
  │
  ▼
PLAYER TRADE  (phase: "player_trade")
  │
  ├── Player has 2 trade slots:
  │   ├── Trade with merchant ship (sell fish/wheat for coins)
  │   ├── Negotiate with NPC (natural language dialogue, max 5 exchanges)
  │   └── Skip (just end turn)
  │
  ├── Player clicks "End Turn"
  │
  ▼
AI TURNS  (phase: "ai_turns")
  │
  ├── For each AI (shuffled order):
  │   ├── LLM decides: labor (fish or farm) + up to 2 trades
  │   ├── Labor is applied immediately
  │   ├── For each trade:
  │   │   ├── trade_merchant → sell resources
  │   │   ├── trade_peer → LLM negotiation (both sides are LLM)
  │   │   └── skip → do nothing
  │   └── All actions broadcast via SSE to frontend
  │
  ▼
SETTLEMENT  (phase: "settlement")
  │
  ├── Every alive character: fish -= 1, wheat -= 1
  ├── Anyone with coins >= 100 → ESCAPED (wins!)
  ├── Anyone with fish <= 0 or wheat <= 0 → ELIMINATED (dead)
  ├── If player is eliminated or escaped → GAME OVER
  │
  ▼
DAY END → next day starts
```

---

## 3. Shared Types

**File**: `packages/shared/src/index.ts`

This is the single source of truth for ALL types used by both server and frontend. Everything is defined with Zod schemas, which gives us:
- Runtime validation (server validates incoming requests)
- TypeScript types (auto-inferred from schemas)
- Consistent types across web and server

### Key types:

| Type | What it is |
|------|-----------|
| `CharacterId` | `'player' \| 'tom' \| 'sam' \| 'lily' \| 'jack'` |
| `Resources` | `{ fish: number, wheat: number, coins: number }` |
| `CharacterState` | One character's full state (resources, trade slots, alive, escaped) |
| `GameState` | The entire game: all characters, friendship matrix, merchant prices, pending harvests, phase, day, logs |
| `PlayerAction` | Discriminated union — what the frontend can send: `fish`, `farm`, `trade_merchant`, `trade_peer`, `negotiate_reply`, `end_turn` |
| `AIDecision` | What the LLM returns: `{ labor: {labor, reasoning}, trades: [{action, ...}] }` |
| `NegotiationMessage` | One message in a trade dialogue: speaker, text, optional proposal, accept/reject |
| `GameSSEEvent` | Events pushed from server to frontend via SSE |
| `DayPhase` | `'day_start' \| 'player_labor' \| 'player_trade' \| 'ai_turns' \| 'settlement' \| 'day_end' \| 'game_over'` |
| `GAME_CONFIG` | All tunable numbers (starting resources, costs, prices, thresholds) |

### Friendship

Friendship between two characters is stored as `Record<string, number>` where the key is `friendshipKey(a, b)` — the two character IDs sorted alphabetically and joined with `:`. Example: `"jack:player" → 15`.

The `friendshipKey()` function ensures the key is always the same regardless of which character you query from.

### If you need to add a new resource or mechanic:
1. Add it to the relevant schema in `packages/shared/src/index.ts`
2. Run `pnpm typecheck` — TypeScript will show you every file that needs updating

---

## 4. Game Engine

**Files**: `apps/server/src/engine/game.ts`

The game engine is a **pure-function state machine**. Every function takes a `GameState` and returns a new `GameState`. No mutations. No side effects. No I/O.

```typescript
// Every engine function looks like this:
function doSomething(state: GameState, ...args): GameState {
  // validate
  // compute new state
  return { ...state, /* changes */ }
}
```

### Key functions:

| Function | What it does |
|----------|-------------|
| `createNewGame(gameId)` | Creates initial state: 5 characters, starting resources, day 1 |
| `startDay(state)` | Generates merchant prices, delivers harvests, resets trade slots, shuffles AI order |
| `applyPlayerAction(state, action)` | Handles player's fish/farm/trade/end_turn — validates phase is correct |
| `applyAILabor(state, charId, 'fish'\|'farm')` | Applies one AI's labor choice |
| `applyAITrade(state, charId, trade)` | Applies one AI's trade action |
| `advanceAIIndex(state)` | Moves to next AI; transitions to 'settlement' when all done |
| `settle(state)` | Deducts daily consumption, checks win/lose, eliminates characters |
| `advanceDay(state)` | Increments day counter, calls startDay() |
| `executePeerTrade(state, from, to, offer, request)` | Swaps resources between two characters, adds friendship |

### Helper functions:

| Function | What it does |
|----------|-------------|
| `applyFish(state, charId)` | +3 fish to character |
| `applyFarm(state, charId)` | Adds pending harvest (arrives in 3 days) |
| `applyMerchantTrade(state, charId, sell)` | Validates resources, calculates coins, deducts trade slot |

### How to change game balance:

Edit `GAME_CONFIG` in `packages/shared/src/index.ts`:

```typescript
export const GAME_CONFIG = {
  STARTING_FISH: 5,          // each character starts with this
  STARTING_WHEAT: 5,
  STARTING_COINS: 0,
  FISH_PER_LABOR: 3,         // fishing gives this many fish
  WHEAT_PER_HARVEST: 8,      // farming gives this many wheat
  HARVEST_DELAY_DAYS: 3,     // farming takes this many days
  DAILY_FISH_COST: 1,        // consumed each night
  DAILY_WHEAT_COST: 1,
  WIN_COINS: 100,            // need this many coins to escape
  TRADE_SLOTS_PER_DAY: 2,    // trades per character per day
  MAX_NEGOTIATION_EXCHANGES: 5, // max messages in one negotiation
  FRIENDSHIP_TRADE_BONUS: 5, // friendship gained per successful trade
  MERCHANT_FISH_PRICE_RANGE: [2, 6],  // random each day
  MERCHANT_WHEAT_PRICE_RANGE: [1, 4],
}
```

---

## 5. AI Agent System

**Files**: `apps/server/src/agents/`

### personalities.ts

Defines the 4 AI characters. Each has:
- `name` — display name
- `description` — one-line summary
- `systemPrompt` — the full personality description injected into every LLM call. This is what makes Tom act cautious and Sam act aggressive.
- `traits` — tags for reference

**To add a new character**: add an entry to `AI_PERSONALITIES`, add the ID to `CharacterIdSchema` and `AI_CHARACTERS` in shared types, then add starting position in `apps/web/src/game/tiles.ts`.

### llm.ts

Low-level LLM API wrapper. Two functions:

- `chatJSON<T>(systemPrompt, userMessage)` — sends a message, extracts JSON from response. Used for structured AI decisions.
- `chatText(systemPrompt, messages)` — sends a conversation, returns plain text. Used for negotiation dialogue.

Both use the `openai` npm package pointing at whatever `OPENAI_BASE_URL` is configured (OpenRouter by default).

**Important**: we do NOT use `response_format: { type: 'json_object' }` because some OpenRouter providers don't support it. Instead, we ask the LLM to return JSON in the prompt, then regex-extract the first `{...}` from the response.

### decision-agent.ts

Called once per AI per turn. Sends the game state to the LLM and gets back a structured decision:

```json
{
  "labor": { "labor": "fish", "reasoning": "I need fish to survive tonight" },
  "trades": [
    { "action": "trade_merchant", "merchantSell": { "fish": 3, "wheat": 0 }, "reasoning": "Good price today" },
    { "action": "trade_peer", "tradeTarget": "lily", "reasoning": "She has wheat I need" }
  ]
}
```

The prompt includes:
- Character's personality (from personalities.ts)
- Current resources, trade slots, merchant prices
- Other characters' resources and friendship levels
- Pending harvests
- Game rules reminder

### negotiation-agent.ts

Handles dialogue when two characters negotiate. Two functions:

- `getAITradeInitiation(state, charId, targetId)` — AI opens a trade conversation
- `getNegotiationReply(state, charId, partnerId, history)` — AI responds to ongoing negotiation

Returns `{ text, offer?, request?, accept?, reject? }`.

### runtime.ts

Orchestrates the full AI turn sequence:

```
for each AI in shuffled order:
  1. broadcast "ai_thinking" SSE event
  2. call getAIDecision() → get labor + trades
  3. broadcast "log" event with reasoning
  4. apply labor
  5. for each trade:
     - if trade_merchant → apply directly
     - if trade_peer → run full negotiation loop (multiple LLM calls)
     - broadcast all negotiation messages as SSE events
  6. advance AI index

then: settle → check eliminations/escapes → advance day
```

### LLM cost

Each AI turn = 1 decision call + 0-2 trade calls. Each negotiation = 2-5 calls.
With 4 AIs, one day costs roughly 4-20 LLM calls.
At DeepSeek pricing via OpenRouter (~$0.27/M tokens), a full game costs < $0.10.

---

## 6. API & SSE

**File**: `apps/server/src/routes/game.ts`

### Endpoints

| Endpoint | Method | What it does |
|----------|--------|-------------|
| `/api/games` | POST | Create new game. Returns `{ gameId, state }` |
| `/api/games/:id` | GET | Get current GameState |
| `/api/games/:id/action` | POST | Submit a PlayerAction. Body is the action JSON |
| `/api/games/:id/stream` | GET | SSE stream — keeps connection open, pushes events |

### Player action flow

```
POST /api/games/:id/action  { type: "fish" }
  → applyPlayerAction(state, action)
  → phase changes from "player_labor" to "player_trade"
  → returns { state }

POST /api/games/:id/action  { type: "end_turn" }
  → phase changes to "ai_turns"
  → kicks off runAITurns() asynchronously
  → AI events stream to frontend via SSE
  → when done, phase becomes "player_labor" (next day)
```

### Negotiation flow

```
POST /action  { type: "trade_peer", target: "tom", message: "I'll sell 3 fish for 10 coins" }
  → deducts 1 trade slot from player
  → calls LLM for Tom's reply
  → returns { state, negotiation: { conversationId, messages: [playerMsg, tomReply] } }

POST /action  { type: "negotiate_reply", conversationId: "...", message: "How about 8 coins?" }
  → adds player message to history
  → calls LLM for Tom's counter
  → returns updated messages

POST /action  { type: "negotiate_reply", ..., accept: true }
  → executes trade (swap resources, +friendship)
  → returns { state, negotiationDone: true }
```

### SSE Events

The server pushes these event types through the SSE stream:

| Event type | When | Data |
|-----------|------|------|
| `state_update` | After any state change | Full GameState |
| `ai_thinking` | AI starts its turn | `{ characterId }` |
| `ai_decision` | AI made a decision | `{ characterId, decision }` |
| `log` | Anytime | `{ message }` — human-readable log line |
| `negotiation` | During AI-AI trades | `{ message: NegotiationMessage }` — dialogue line |
| `trade_result` | Trade completed/failed | `{ success, from, to, summary }` |
| `settlement` | Night phase | `{ results: string[] }` |
| `elimination` | Character died | `{ characterId }` |
| `escape` | Character escaped | `{ characterId }` |
| `game_over` | Game ended | `{ winnerId, reason }` |
| `day_start` | New day begins | `{ day, merchantPrices }` |

### State management

**File**: `apps/server/src/state.ts`

Active games are stored in an in-memory `Map<string, GameSession>`. Each session contains:
- `gameId`
- `state` — current GameState
- `sseClients` — Set of connected SSE response objects

`broadcastSSE(gameId, event)` writes `data: {...}\n\n` to all connected clients.

Games are also persisted to SQLite (`games` table) after every state change, so they survive server restarts.

---

## 7. Frontend Architecture

```
apps/web/src/
├── game/              # PixiJS layer (renders the island)
│   ├── tiles.ts       # Map data: 20x15 grid of tile types + positions
│   ├── TileMap.ts     # Draws all tiles (water, grass, sand, buildings)
│   ├── Character.ts   # Character sprite with animation
│   ├── InputManager.ts # WASD + E keyboard handling
│   ├── GameWorld.ts   # Orchestrates map + characters + interactions
│   └── GameRenderer.ts # Creates PixiJS Application, mounts canvas
│
├── components/        # Vue UI overlays
│   ├── GameCanvas.vue # Wrapper: mounts PixiJS, bridges events to Vue
│   ├── HUD.vue        # Top bar: day, phase, resources, prices, escape %
│   ├── ActionMenu.vue # Context menu when pressing E (phase-aware)
│   ├── DialoguePanel.vue  # Right sidebar for NPC negotiation
│   ├── InteractionPrompt.vue  # "Press E to..." prompt
│   └── EventLog.vue   # Bottom log of all game events
│
├── stores/
│   └── game.ts        # Pinia store: game state + SSE + API calls
│
├── composables/
│   └── useApi.ts      # Typed fetch wrappers for all endpoints
│
├── App.vue            # Main layout: title screen or game screen
├── main.ts            # Vue bootstrap
└── styles.css         # Global styles + CSS variables
```

### How PixiJS and Vue interact

PixiJS handles: rendering the island, character sprites, movement animation, tile map
Vue handles: all UI text, buttons, forms, dialogue, HUD, event log

They communicate through:
1. **GameCanvas.vue** — mounts PixiJS canvas, listens to game world events, emits to parent
2. **Pinia store** — PixiJS reads game state from store; Vue writes to store via API calls
3. **Events** — GameWorld emits events like `interaction-change`, `action-menu`, `player-moved`

---

## 8. PixiJS Game Rendering

### tiles.ts

The island map is a 20x15 grid. Each cell has a tile type:

```typescript
type TileType = 'water' | 'sand' | 'grass' | 'farmland' | 'dock' | 'house' | 'tree' | 'rock' | 'fishing_spot' | 'path'
```

The `MAP_DATA` array defines the full layout. `WALKABLE_TILES` determines where characters can walk. `CHARACTER_POSITIONS` defines starting positions for each character.

**To change the map**: edit `MAP_DATA` in `tiles.ts`. Each row is an array of tile type strings.

### TileMap.ts

Draws every tile using PixiJS Graphics (colored rectangles, patterns):
- Water: blue with wave animation
- Grass: green
- Sand: tan
- Farmland: brown with crop rows
- Houses: rectangles with colored roofs
- Trees: green circles on brown trunks
- Merchant ship: drawn at the dock position

All art is **programmatic** — no image files needed. If you want to add real sprite sheets later, replace the `Graphics` drawing code with `Sprite` loading.

### Character.ts

Each character is drawn as a small pixel figure with:
- Head (skin color circle)
- Body (colored shirt — red for player, orange for Tom, etc.)
- Name label above
- Walking animation (smooth interpolation between tiles)
- Thinking indicator (shown during AI turns)
- Eliminated state (greyed out)

`walkPath(path)` — makes a character follow a path of tile coordinates, used during AI turns.

### GameWorld.ts

The main orchestrator. Manages:
- The tile map layer
- All character sprites
- Player movement (checks walkability, detects nearby interactables)
- Interaction detection (when player is adjacent to NPC/fishing/farm/ship)
- AI movement animation
- Floating text effects ("+3 Fish!", "Planted!")
- Night overlay effect

Emits events to Vue: `interaction-change`, `action-menu`, `player-moved`.

### InputManager.ts

Listens for keyboard events:
- WASD / Arrow keys → movement (ignored when typing in input fields)
- E / Space → interact with nearby entity

---

## 9. Vue UI Components

### GameCanvas.vue

Wraps the PixiJS canvas in a Vue component. On mount:
1. Creates `GameRenderer`
2. Initializes the game world with character positions from game state
3. Watches Pinia store for phase changes (enables/disables input)
4. Watches SSE events to animate AI decisions
5. Forwards game world events to parent (App.vue)

### HUD.vue

Top bar. All reactive via Pinia computed properties. Shows:
- Day number
- Phase badge (color changes by phase: green for player turns, blue for AI, purple for night)
- Fish / Wheat / Coins counts
- Trade slots remaining
- Merchant ship prices
- Escape progress bar (coins / 100)

### ActionMenu.vue

**Phase-aware** popup when pressing E near something:

- `player_labor` phase + fishing spot → "Go Fishing (+3 fish)" button
- `player_labor` phase + farmland → "Plant Wheat (+8 in 3 days)" button
- `player_labor` phase + NPC/ship → "You must labor first!"
- `player_trade` phase + NPC → "Negotiate a trade" button
- `player_trade` phase + merchant ship → sell interface (quantity inputs + price calculation)
- `player_trade` phase + fish/farm → "Already labored today"

### DialoguePanel.vue

Right sidebar for trading with NPCs. Contains:
- Chat message history
- **Quick Trade template**: Buy/Sell dropdown + amount + resource + price → "Propose" button
- Free-form text input + "Send" button
- "Accept Deal" and "Reject" buttons
- Exchange counter (X/10)

The first message triggers `trade_peer` action. Subsequent messages trigger `negotiate_reply`.

### InteractionPrompt.vue

Small prompt at bottom: "Press E to go fishing (+3 fish)" / "Press E to talk to Tom". Also phase-aware — shows "(Already labored today)" or "(Trade phase only)".

### EventLog.vue

Collapsible bottom panel. Shows two sources:
1. `game.state.log` — game engine log entries ("player went fishing", "Tom sold 3 fish")
2. `game.events` (SSE) — real-time events (AI thinking, negotiation dialogue, trade results)

Color-coded: yellow for day headers, blue for AI actions, purple for dialogue, green for successful trades, red for failures/eliminations.

---

## 10. State Management

**File**: `apps/web/src/stores/game.ts`

Single Pinia store that holds everything:

```typescript
// Core state
gameId          // current game ID (null = title screen)
state           // full GameState from server
events          // array of all SSE events received
isLoading       // true during API calls
activeNegotiation  // current negotiation state (if any)
thinkingCharacter  // which AI is currently "thinking"

// UI state
currentInteraction  // what the player is standing near (NPC/fish/farm/ship)
showActionMenu     // whether the action menu popup is visible
showDialoguePanel  // whether the right-side dialogue panel is visible
dialogueTarget     // which NPC we're talking to
```

### Actions

- `newGame()` — POST /api/games, connects SSE
- `submitAction(action)` — POST /api/games/:id/action, handles negotiation responses
- `connectSSE()` / `disconnectSSE()` — manages EventSource connection with auto-reconnect
- `openNegotiation(target, convId)` — opens dialogue panel
- `closeNegotiation()` — closes dialogue panel

### SSE handling

`connectSSE()` opens an `EventSource` to `/api/games/:id/stream`. On each message:
1. Parse JSON
2. Push to `events` array (for EventLog display)
3. Call `handleSSEEvent()` which updates store state based on event type

---

## 11. Configuration & Environment

### .env file

```
OPENAI_API_KEY=<key>                    # Required. OpenRouter or OpenAI key
OPENAI_BASE_URL=https://openrouter.ai/api/v1  # API endpoint
OPENAI_MODEL=deepseek/deepseek-chat     # Model to use
DB_FILE_NAME=file:local.db              # SQLite file path
LOG_LEVEL=info                          # Pino log level
```

### Changing LLM provider

Just change `.env`:
- **OpenRouter**: `OPENAI_BASE_URL=https://openrouter.ai/api/v1`, model like `deepseek/deepseek-chat`
- **OpenAI direct**: remove OPENAI_BASE_URL, model like `gpt-4.1-nano`
- **Local Ollama**: `OPENAI_BASE_URL=http://localhost:11434/v1`, model like `deepseek-r1:7b`
- **DeepSeek direct**: `OPENAI_BASE_URL=https://api.deepseek.com/v1`, model like `deepseek-chat`

### Vite proxy

`apps/web/vite.config.ts` proxies `/api` to `http://127.0.0.1:8787` in dev mode, so the frontend doesn't need to know the server URL.

---

## 12. Common Tasks

### Add a new resource type

1. Add field to `ResourcesSchema` in `packages/shared/src/index.ts`
2. Add starting value to `GAME_CONFIG`
3. Update `makeCharacter()` in `engine/game.ts`
4. Update `settle()` if it has daily consumption
5. Update AI prompts in `decision-agent.ts` to mention the new resource
6. Update HUD.vue to display it
7. Run `pnpm typecheck` to find anything you missed

### Add a new NPC

1. Add ID to `CharacterIdSchema` and `AI_CHARACTERS` in shared types
2. Add personality in `apps/server/src/agents/personalities.ts`
3. Add starting position in `apps/web/src/game/tiles.ts` (`CHARACTER_POSITIONS`)
4. Add meta (name, emoji) in `apps/web/src/stores/game.ts` (`CHARACTER_META`)
5. Add shirt color in `apps/web/src/game/Character.ts`

### Change the map

Edit `MAP_DATA` in `apps/web/src/game/tiles.ts`. It's a 2D array of tile type strings. The map is 20 columns x 15 rows. Make sure walkable areas are connected and character positions are on walkable tiles.

### Add a random event system

1. Define event types in shared types
2. Add an `applyRandomEvent(state)` function in `engine/game.ts`
3. Call it from `startDay()` with some probability
4. Add SSE event type for broadcasting
5. Show in EventLog

### Run tests

```bash
pnpm test          # all tests
pnpm test:unit     # unit only
```

### Build for production

```bash
pnpm build
# Web artifact: apps/web/dist/
# Server artifact: apps/server/dist/
```

---

## 13. Known Issues & TODOs

### Issues

- [ ] Button clicks on action menu sometimes don't register (PixiJS canvas intercepts pointer events). Workaround: `pointer-events: none` is set on canvas when menu is open, but may need more testing.
- [ ] AI turns take 15-30 seconds (4 sequential LLM calls). Could be parallelized for independent AIs.
- [ ] SSE reconnection after server hot-reload sometimes fails — refresh the page.
- [ ] No save/load UI yet (backend supports it but frontend doesn't expose it).

### TODO features

- [ ] Random daily events (storms, bumper crops, pirates)
- [ ] AI characters visually walk to their targets during AI turns
- [ ] Sound effects
- [ ] Real pixel art sprites instead of programmatic drawing
- [ ] Mobile touch support
- [ ] Multiplayer (multiple human players)
- [ ] AI-to-player initiated trades (currently only player can initiate with NPCs)
- [ ] Victory/defeat screen with game statistics
- [ ] Replay system (all state transitions are logged)

---

## File-by-File Reference

| File | Purpose |
|------|---------|
| `packages/shared/src/index.ts` | All Zod schemas and types |
| `apps/server/src/index.ts` | Server entry point (port 8787) |
| `apps/server/src/app.ts` | Fastify setup, registers routes |
| `apps/server/src/env.ts` | Environment variable parsing |
| `apps/server/src/state.ts` | In-memory game sessions + SSE broadcast |
| `apps/server/src/db/schema.ts` | Drizzle table definitions (saves, games) |
| `apps/server/src/db/client.ts` | SQLite client + schema init |
| `apps/server/src/engine/game.ts` | Pure-function game state machine |
| `apps/server/src/agents/personalities.ts` | AI character definitions |
| `apps/server/src/agents/llm.ts` | OpenAI SDK wrapper |
| `apps/server/src/agents/decision-agent.ts` | AI turn decision (labor + trades) |
| `apps/server/src/agents/negotiation-agent.ts` | AI trade dialogue |
| `apps/server/src/agents/runtime.ts` | Orchestrates full AI turn sequence |
| `apps/server/src/routes/game.ts` | REST + SSE API endpoints |
| `apps/web/src/App.vue` | Main layout (title screen / game screen) |
| `apps/web/src/stores/game.ts` | Pinia state management |
| `apps/web/src/composables/useApi.ts` | API fetch helpers |
| `apps/web/src/game/tiles.ts` | Map layout data |
| `apps/web/src/game/TileMap.ts` | PixiJS tile renderer |
| `apps/web/src/game/Character.ts` | PixiJS character sprite |
| `apps/web/src/game/InputManager.ts` | Keyboard input |
| `apps/web/src/game/GameWorld.ts` | PixiJS world orchestrator |
| `apps/web/src/game/GameRenderer.ts` | PixiJS application setup |
| `apps/web/src/components/GameCanvas.vue` | PixiJS ↔ Vue bridge |
| `apps/web/src/components/HUD.vue` | Top status bar |
| `apps/web/src/components/ActionMenu.vue` | Interaction context menu |
| `apps/web/src/components/DialoguePanel.vue` | NPC trade dialogue |
| `apps/web/src/components/InteractionPrompt.vue` | "Press E" prompt |
| `apps/web/src/components/EventLog.vue` | Bottom event log |
