<div align="center">

<img src="docs/banner.png" alt="IslandEscape — 2D pixel-art survival game with LLM-powered AI agents" width="100%">

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org)
[![Vue 3](https://img.shields.io/badge/Vue-3-42b883)](https://vuejs.org)
[![Fastify](https://img.shields.io/badge/Fastify-server-black)](https://fastify.dev)

[**Quick Start**](#quick-start) · [**The Idea**](#the-idea) · [**Meet the Islanders**](#meet-the-islanders) · [**Architecture**](#architecture) · [中文](README_CN.md)

</div>

You wash up on a small island with four strangers. Everyone needs the same thing: 100 coins to buy passage off the rock before the food runs out. You fish, you farm, you haggle. So do they. The catch is that the four other survivors are large language models, and they hold grudges, form alliances, and have been known to quietly stop giving you good deals right when you're one trade away from winning.

**IslandEscape** is a 2D pixel-art survival trading game where every non-player character is driven by an LLM, and a small typed game engine keeps all of them honest.

![Gameplay — the island, the four AI islanders, and the merchant ship](docs/screenshots/gameplay.png)

## The Idea

Most "AI in games" bolts a chatbot onto an NPC and hopes the model stays in character. The problem is that a model will happily invent coins it doesn't have, accept a trade it can't pay for, or narrate itself to victory. Once the model can touch the rules, the economy falls apart.

So IslandEscape splits responsibility down the middle:

| The LLM owns | The game engine owns |
|---|---|
| **Intention** — what an NPC actually wants this turn | **Resources** — every coin, fish, and unit of wheat |
| **Dialogue** — how it says it, in natural language | **Phases** — labor, trade, settlement, day rollover |
| **Personality** — cautious, aggressive, cooperative, cunning | **Trade execution** — validate the deal, then transfer |
| **Bargaining style** — generous, or a hard no | **Win / loss** — elimination and escape |

The model proposes; the engine disposes. Every action an NPC wants to take is a structured proposal validated against a [Zod](https://zod.dev) schema before a single resource moves. If the model hallucinates a trade it can't afford, the engine rejects it and the world stays consistent. The result is the line the whole project is built around:

> The model creates the expression; the typed game engine owns the rules.

## Meet the Islanders

Four NPCs, four system prompts, four very different ways to do business. Here they are answering the *exact same* opening offer — "I'll buy 3 fish for 10 coins":

![The same offer answered by three different AI personalities](docs/screenshots/personalities.png)

| Character | Personality | How they play |
|-----------|-------------|---------------|
| **Tom** | Cautious Fisherman | Hoards fish, distrusts coins, drives a hard bargain — but loyal once he trusts you |
| **Sam** | Aggressive Trader | Flips resources for profit, charming and quick, not always reliable |
| **Lily** | Cooperative Farmer | Builds alliances, generous to friends, would rather swap goods than fight |
| **Jack** | Cunning Opportunist | Reads desperation, smiles while he squeezes you, plays the long game |

Friendship is real state, not flavor text. Successful trades raise an NPC's regard for you, which shifts their prices, their willingness to deal, and who they'll team up with. Burn someone late in the game and the island remembers.

## How a Negotiation Works

Walk up to an islander, press **E**, and you're in a conversation. You can use a quick-trade template or just type what you want. Each exchange round is a real LLM call; the model reads the game state, its own personality, its friendship level with you, and the conversation so far, then comes back with a reply and a structured proposal you can accept, counter, or reject.

<div align="center"><img src="docs/screenshots/negotiation.png" alt="Negotiating a trade with Tom, the cautious fisherman" width="42%"></div>

```
You send a message  →  NPC thinks (LLM call)  →  NPC replies with a proposal  →  Accept / Counter / Reject
```

A conversation runs up to five exchanges and costs one trade slot whether or not you close a deal, so opening your mouth has a price. The proposal that comes back is never trusted on faith: it's parsed, schema-checked, and only executed if both sides can actually pay.

## The Daily Loop

Each day moves through fixed phases, for you and for every AI in turn:

1. **Day start** — the merchant ship arrives with fresh random prices; any farming you started comes in.
2. **Labor** (mandatory) — fish for **+3 fish** now, or farm for **+8 wheat** that lands in three days.
3. **Trade** (2 slots) — sell to the ship for coins, or negotiate goods with the islanders.
4. **AI turns** — each of the four LLM agents labors, then spends its own trade slots however it decides.
5. **Settlement** — everyone eats **1 fish + 1 wheat**. Run out and you're eliminated.
6. **Escape** — first to **100 coins** boards the ship and wins.

**The numbers that matter**

| | |
|---|---|
| Starting supplies | 6 fish + 6 wheat |
| Nightly cost | 1 fish + 1 wheat |
| Fishing | +3 fish per labor |
| Farming | +8 wheat, ready in 3 days |
| Fish price | 2–6 coins (random daily) |
| Wheat price | 1–4 coins (random daily) |
| Trade slots | 2 per day |
| Win condition | 100 coins |

Coins only come from the merchant ship, and the ship only wants fish and wheat. That single bottleneck is what forces everyone to the negotiating table.

## Boss Dungeon

There's a faster, riskier road to those coins. Once a day you can spend a trade slot to enter the dungeon and fight the **Giant Crab**, a bullet-hell boss with a 150-HP state machine that escalates through three phases. It opens with aimed four-bullet volleys, then adds spinning ring barrages and summoned minions as its health drops, and in its final quarter throws eight-bullet volleys, denser rings, and a faster charge. The boss also scales with the day, so later runs hit harder.

![Boss dungeon — bullet-hell fight against the Giant Crab](docs/screenshots/boss-dungeon.png)

- **Enter:** costs 1 trade slot, once per day
- **Win:** +15 coins, scaling up the longer you've survived (capped at 80)
- **Lose:** up to −5 fish and −5 wheat (you always keep at least 1 of each)
- **Cards:** land hits to earn XP, then pick 1 of 3 upgrades (Multi Shot, Piercing, Heal, and more) from a pool of 8

It turns every day into a real decision: play the market safely, or gamble resources you might need to survive the night for a shortcut to escape.

## Architecture

The server is the single source of truth. The browser sends *actions*; the backend validates them, advances the state machine, and streams the result back over SSE. Nothing the frontend or an LLM says is trusted until the engine has checked it.

![System architecture — browser, server, game engine, AI agents, shared Zod schemas](docs/architecture.png)

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3 + TypeScript + Vite + Pinia + Tailwind CSS v4 |
| 2D world | PixiJS — tile map, characters, A\* pathfinding on an HTML5 canvas |
| 3D preview | Three.js — WebGL scene for character/model previews |
| Backend | Fastify + Zod + Drizzle ORM + SQLite |
| Game engine | Pure-function state machine with Zod-validated transitions |
| AI agents | OpenAI-compatible API (DeepSeek via OpenRouter by default) |
| Shared | Zod schemas in `packages/shared`, one contract for web and server |

```
.
├── apps/
│   ├── web/                 # Vue 3 frontend with the PixiJS game canvas
│   │   ├── src/game/        # PixiJS: tile map, characters, input, world
│   │   ├── src/components/  # Vue: HUD, ActionMenu, DialoguePanel, EventLog
│   │   ├── src/stores/      # Pinia game store + SSE handling
│   │   └── src/composables/ # API helpers
│   └── server/              # Fastify backend
│       ├── src/engine/      # Game state machine (pure functions)
│       ├── src/agents/      # LLM layer: decision, negotiation, personalities
│       ├── src/routes/      # REST + SSE endpoints
│       └── src/db/          # Drizzle + SQLite persistence
└── packages/
    └── shared/              # Zod schemas shared between web and server
```

Because the engine is pure functions over typed state, it's straightforward to test without ever calling a model.

![vitest — engine, schema, and component suites all passing](docs/screenshots/tests.png)

```bash
pnpm test
```

## Quick Start

Requirements: **Node.js >= 22.12** and **pnpm** (via Corepack).

```bash
corepack enable pnpm
corepack use pnpm@latest-10
git clone https://github.com/he-yufeng/IslandEscape.git
cd IslandEscape
pnpm install
cp .env.example .env
```

Open `.env` and drop in any OpenAI-compatible key. The default points at OpenRouter with DeepSeek, which is cheap and fast enough for in-game dialogue:

```
OPENAI_API_KEY=<your-openrouter-or-openai-key>
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=deepseek/deepseek-chat
DB_FILE_NAME=file:local.db
LOG_LEVEL=info
```

Then run it:

```bash
pnpm dev
```

- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:8787

Open the frontend, click **NEW GAME**, and you're on the island. If NPC replies feel slow, that's the model API thinking — the game state and the rules are validated locally and stay correct regardless.

For a single-process production build, `pnpm build && pnpm start` serves both the API and the built web app from Fastify; set `HOST=0.0.0.0` and `PORT=<port>` when deploying.

## How to Play

1. Open http://localhost:5173 and click **NEW GAME**.
2. **WASD** to move around the island.
3. **E** to interact — fishing spots, farmland, the merchant ship, or an NPC.
4. **Labor first** (fish or farm) — it's mandatory each day.
5. **Then trade** — sell to the ship, or walk up to an islander and negotiate.
6. Click **End Turn** and watch the four AIs take theirs.
7. Survive the nightly drain and be the first to 100 coins.

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/games` | Create a new game |
| GET | `/api/games/:id` | Get current game state |
| POST | `/api/games/:id/action` | Submit a player action |
| GET | `/api/games/:id/stream` | SSE stream of real-time AI-turn updates |

## Roadmap

What plays end-to-end today is the full loop: daily phases, the merchant economy, LLM-driven negotiation, the boss dungeon, and elimination. The honest limitations, and where it goes next:

- **NPC memory** — agents reason over the current state and the live conversation, but don't yet carry long-term memory across many days. Deeper memory is the biggest lever on how "alive" they feel.
- **Economy ↔ dungeon balance** — the safe market path and the risky dungeon path need tuning so neither dominates.
- **Pacing** — LLM latency shapes turn rhythm; batching and local-model support would smooth it out.
- **Local-model mode** — run NPC dialogue against a local model (e.g. Ollama) so the game is fully playable without a hosted key.
- **Save and resume**, and a real **difficulty curve** across early and late game.
- **Real-time multiplayer**, so the islanders aren't the only ones who can gang up on you.

## References

- [Generative Agents (Park et al., 2023)](https://arxiv.org/abs/2304.03442) — believable LLM-agent behavior
- [Project Sid (2024)](https://arxiv.org/abs/2411.00114) — emergent economies in multi-agent simulations
- [AI Town (a16z)](https://github.com/a16z-infra/ai-town) — open-source LLM agent simulation

## Credits

Built as a COMP7604 game-design project at HKU. Team and roles: **He Yufeng** (AI agents, coordination, integration), **Xu Junjie** (dialogue, server, bug-fixing), **Yu Erfei** (boss dungeon, combat), **Long Huzhiyuan** (3D preview, visuals).

## License

MIT
