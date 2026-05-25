# Final Presentation Outline

Target length: 6-7 minutes.

- PPT: 3-4 minutes.
- Demo video: about 2 minutes.
- Live game proof: 1-2 minutes.

The PPT should not try to explain every implementation detail. Its job is to
frame the design and engineering choices before the video and short live run.

## Slide 1 - Island Escape

Time: 0:00-0:25

Main message:

- Island Escape is a survival trading game with LLM-driven NPC negotiation.
- The player must survive, trade, and reach 100 coins to escape.
- The project is a playable game first, not only a chatbot demo.

Visual:

- Title screen screenshot.
- Subtitle: "Survive, bargain, and escape with AI agents."

Speaker note:

> Our goal was to make conversation affect actual game decisions, not just sit
> beside the game as decoration.

## Slide 2 - Design Problem And Goal

Time: 0:25-0:55

Main message:

- Traditional NPC dialogue is often fixed.
- AI demos can have interesting dialogue but weak game structure.
- Island Escape combines deterministic survival/trading rules with flexible
  LLM negotiation.

Visual:

- Two-column contrast: fixed NPC menu vs. AI negotiation inside a rule-based
  economy.

Speaker note:

> We use AI where it is strong: language, personality, and bargaining style. We
> keep deterministic code where the game needs fairness.

## Slide 3 - Core Game Loop

Time: 0:55-1:35

Main message:

- Every day has four steps: labor, trade, AI turns, settlement.
- Fish and wheat keep characters alive; coins are the escape objective.
- Trade slots make negotiation a limited resource.

Visual:

- Loop diagram: Labor -> Trade -> AI Turns -> Settlement.
- Small HUD screenshot showing resources, phase, and trade slots.

Speaker note:

> Talking is not unlimited. It competes with merchant selling and dungeon entry,
> so dialogue becomes part of the economy.

## Slide 4 - AI Negotiation

Time: 1:35-2:15

Main message:

- NPCs respond with personality and bargaining style.
- The player can use natural language.
- The model does not directly mutate resources or phase.

Visual:

- Dialogue panel screenshot.
- Small sequence: player message -> NPC thinking -> NPC reply -> server
  validation.

Speaker note:

> The model creates social behavior. The backend checks whether the proposed
> action is legal.

## Slide 5 - Engineering Architecture

Time: 2:15-2:55

Main message:

- Frontend: Vue, PixiJS, Pinia, 3D preview, dungeon UI, sound.
- Backend: Fastify state machine, validation, AI calls, SQLite persistence.
- Shared Zod schemas keep frontend and backend contracts typed.

Visual:

- Architecture diagram: Browser -> API -> game engine / AI runtime / database.

Speaker note:

> This separation is what makes the project robust: LLM output can vary, but the
> game state remains deterministic and testable.

## Slide 6 - Final Polish And Extensions

Time: 2:55-3:35

Main message:

- 3D preview and UI polish make interaction easier to read.
- Boss dungeon adds a high-energy risk-reward path.
- Sound effects improve live readability.
- Validation was kept in the loop: lint, typecheck, tests, build.

Visual:

- Boss arena screenshot or video still.
- Small checklist: lint, typecheck, tests, build.

Speaker note:

> The dungeon is not separate from the economy. It costs a trade slot and can
> reward coins or punish the player with resource loss.

## Slide 7 - Demo Video

Time: 3:35-5:35

Main message:

- The video shows the complete intended flow without waiting on every model
  call live.
- Show: new game, movement, labor, NPC negotiation, AI turns, dungeon.

Visual:

- Embedded or linked 90-120 second edited video.

Speaker note:

> The video is the proof of the full loop. I will only comment on the key
> moments instead of narrating every frame.

## Slide 8 - Live Build And Q&A

Time: 5:35-7:00

Main message:

- The final 1-2 minutes are a short live proof that the submitted build runs.
- Do not replay the whole video live.
- Use live play to show `NEW GAME`, movement, and one interaction.

Visual:

- Keep this slide minimal: "Live build + questions".
- Optional backup command list:
  - `pnpm dev`
  - `http://localhost:5173`

Speaker note:

> I will briefly open the live build now. If model latency is slow, I will not
> wait for the full response because the video already showed the complete path.
