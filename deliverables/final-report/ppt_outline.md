# Final Presentation Outline

Target length: 7 minutes. Suggested deck length: 8 slides, with the demo video embedded or linked on slide 7.

## Slide 1 - Island Escape

Time: 0:00-0:35

Main message:

- Island Escape is a survival trading game where LLM-driven NPCs negotiate, compete, and react to scarcity.
- The player must gather resources, trade intelligently, and reach 100 coins before the island economy eliminates them.

Visual:

- Title screen screenshot.
- Subtitle: "Survive, bargain, and escape with AI agents."

## Slide 2 - Core Game Loop

Time: 0:35-1:25

Main message:

- Every day has a fixed rhythm: labor, trade, AI turns, settlement.
- Fish and wheat keep characters alive; coins are the escape objective.
- Trade slots make negotiation a limited resource rather than infinite chatting.

Visual:

- Four-step loop: Labor -> Trade -> AI Turns -> Settlement.
- Small resource table: fish, wheat, coins, trade slots.

## Slide 3 - Why LLM Agents Fit This Game

Time: 1:25-2:15

Main message:

- The LLM is used where fixed rules are weakest: dialogue, personality, bargaining style, and intent.
- The model does not directly change game state.
- Typed server logic validates all resource transfers and phase transitions.

Visual:

- Two-column diagram:
  - LLM controls: intention, dialogue, personality.
  - Game engine controls: resources, phases, trade execution, win/loss.

## Slide 4 - NPC Negotiation Flow

Time: 2:15-3:10

Main message:

- The player sends natural language plus optional structured proposal.
- NPC replies with text and may attach an offer/request.
- Optimistic UI and thinking states keep the flow readable while the model is responding.

Visual:

- Dialogue panel screenshot.
- Mini sequence: Player message -> NPC thinking -> NPC reply -> accept/counter/reject.

## Slide 5 - Engineering Architecture

Time: 3:10-4:05

Main message:

- Vue + PixiJS frontend.
- Fastify backend as source of truth.
- Shared Zod schemas connect frontend and backend.
- SSE streams expose AI progress in real time.
- SQLite persistence keeps game sessions recoverable.

Visual:

- Architecture diagram:
  - Browser: Vue UI, PixiJS canvas, Pinia store.
  - Server: routes, engine, AI runtime, SQLite.
  - Shared: Zod schemas.

## Slide 6 - Final Gameplay Extension: Boss Dungeon

Time: 4:05-5:00

Main message:

- The dungeon is a risk/reward action during the trade phase.
- It costs a trade slot and is limited to once per day.
- Winning grants coins; losing costs resources.
- It adds a high-energy moment to the demo while still feeding the economy.

Visual:

- Boss arena screenshot or short GIF frame.
- Outcome table: enter cost, win reward, loss penalty.

## Slide 7 - Demo Video

Time: 5:00-6:20

Main message:

- Show: new game, movement, labor, NPC trade, AI turn, dungeon.
- Speed up slow waits; keep one negotiation moment at normal speed.

Visual:

- Embedded 90-120 second edited video.

## Slide 8 - Validation, Contributions, and Next Steps

Time: 6:20-7:00

Main message:

- Validation: lint, typecheck, tests, build.
- Contributions: coordination/AI architecture/final integration/report; dialogue fixes; boss work; rendering/visual section.
- Limitations: LLM latency, balance tuning, richer memory.
- Future work: deeper agent memory, better evaluation, stronger economy-dungeon coupling.

Visual:

- Validation checklist with pass marks.
- One small future-work list.
