# Presentation Speech Script

Target: about 7 minutes. This is written for the project coordinator as the main speaker. Edit names and screenshots after the final video is ready.

## 0:00-0:35 - Opening

Good morning. Our project is called Island Escape. It is a survival trading game where the player is stranded on an island with four AI-controlled characters.

The goal is simple: survive long enough to collect 100 coins and escape. But the interesting part is that coins do not come from clicking a button. You need to gather resources, sell to a merchant ship, and negotiate with NPCs who have their own personalities and incentives.

So the game is not only about resource optimization. It is also about social bargaining under scarcity.

## 0:35-1:25 - Core Loop

The game runs in daily cycles.

At the start of each day, merchant prices refresh and pending harvests are resolved. Then the player must do labor. Fishing gives immediate fish, while farming creates a delayed wheat harvest. After that, the player enters the trade phase and has a limited number of trade slots.

During the trade phase, the player can sell resources to the merchant, negotiate with NPCs, enter the dungeon, or end the turn. After the player ends the turn, the AI agents act, and then settlement happens. Settlement consumes fish and wheat from every character. If a character runs out of either resource, they are eliminated.

This loop is deliberately easy to understand. The depth comes from choosing when to invest, when to sell, when to bargain, and when to take risks.

## 1:25-2:15 - AI Design

The main AI design decision was to use the language model for the parts where it is actually valuable: personality, intention, and negotiation.

We do not let the model directly modify game state. That would be risky, because an LLM can hallucinate or output inconsistent facts. Instead, the model proposes actions or dialogue, and the server validates everything.

For example, an NPC can say that it accepts a trade, but the server still checks whether the latest structured proposal is valid and whether both sides actually have the resources. The model creates expression; the typed game engine owns the rules.

This separation is the core engineering idea behind the project.

## 2:15-3:10 - Negotiation Flow

In the negotiation UI, the player can send a natural-language message and, when needed, attach a concrete trade proposal. The NPC then responds based on its personality, resources, and dialogue history.

One thing we improved late in development was the feeling of responsiveness. LLM calls are not instant, and in an earlier version the player could send a message and not see anything immediately. That made the game feel like it was stuck.

Now the UI shows the player's message optimistically and displays a thinking state while waiting for the server response. When the server returns, the authoritative conversation replaces the optimistic version. This makes the LLM delay understandable instead of confusing.

## 3:10-4:05 - Architecture

The project is organized as a TypeScript monorepo.

The frontend is Vue 3 with Pinia for state and PixiJS for the game canvas. The backend is Fastify, with a deterministic game engine, an AI runtime, and SQLite persistence. Shared Zod schemas define the contract between frontend and backend.

The server is the source of truth. The frontend sends an action to the backend, the backend validates it, updates the state, persists it, and broadcasts real-time events through SSE.

This is especially important because AI turns and negotiations are asynchronous. The UI can show progress, but the backend owns the state ledger.

## 4:05-5:00 - Boss Dungeon

For the final version, we added a boss dungeon as a higher-energy extension to the main economy.

The dungeon is not separate from the game loop. It is an optional trade-phase action. Entering costs one trade slot and can only happen once per day. If the player wins, they gain coins. If they lose, they lose resources.

Inside the dungeon, the player fights a boss with movement, shooting, flash movement, an ultimate skill, XP, and card upgrades. This creates a more dynamic demo moment while still connecting back to the survival economy.

So the dungeon gives the player a strategic question: do I use my trade slot safely, or do I risk resources for a faster path to escape?

## 5:00-6:20 - Demo Video

Now I will show a short demo video. It includes the main flow: starting a game, moving around the island, performing labor, negotiating with an NPC, seeing AI activity, and entering the boss dungeon.

[Play demo video.]

The video is edited because a full game day and LLM responses can take longer than the presentation slot. In a live demo, we would show a shorter path and rely on the video for the complete flow.

## 6:20-7:00 - Validation and Closing

Before final submission, we validated the project with linting, TypeScript checks, unit tests, and production build. During final integration, this was useful because tests alone passed at one point while typecheck and build still caught integration issues in the dungeon preview and shared state fields.

In terms of contributions, I focused on the AI architecture, coordination, final integration, validation, report, and presentation. Other teammates worked on dialogue fixes, the boss feature, visuals, and the final video/PPT assets.

The project still has limitations: LLM latency, game balance, and deeper long-term memory for NPCs. But the prototype demonstrates the main idea clearly: a game where LLM agents make negotiation feel alive, while typed deterministic code keeps the game fair and correct.

Thank you.
