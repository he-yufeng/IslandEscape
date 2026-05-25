# Island Escape Live Demo: One-Page Cue Card

Use this if you only have one screen or one printed page before presenting.

## Core Message

Island Escape is a playable AI negotiation game.

- Resources create pressure: fish and wheat keep characters alive.
- Coins create the goal: first to 100 coins escapes.
- LLMs create social behavior: NPCs negotiate with personality.
- The backend protects correctness: rules, resources, phases, and trades are deterministic.

## 7-Minute Route

1. Start from title screen and click `NEW GAME`.
2. Show HUD: day, fish, wheat, coins, trade slots, phase, daily event.
3. Move with `WASD`; interact with `E`.
4. Do labor first: fish or farm.
5. Talk to one NPC and send a short message.
6. While the NPC thinks, explain LLM latency and optimistic UI.
7. End turn and show AI actions / event log.
8. Enter dungeon if possible; show movement, sound, combat, `Space`, `Q`.
9. Close with the architecture sentence.
10. Stop and take questions.

## Best Short Lines

Opening:

> I will present by playing the game directly. The goal is to survive, trade, and become the first character to collect 100 coins.

LLM line:

> The LLM controls dialogue and intention, but it does not own the game state.

Engineering line:

> The model creates social behavior; deterministic backend code owns fairness and validation.

Dungeon line:

> The dungeon is a risk-reward shortcut to coins, but it costs a trade slot and can cost resources if I lose.

Closing:

> This is not just a chatbot. It is a playable game loop where negotiation changes economic decisions.

## If The Demo Is Slow

NPC response slow:

> This is an external model call. The important part is that the UI shows the pending state and the backend keeps the game state safe.

Cannot reach dungeon:

> Dungeon is trade-phase only and costs one trade slot, so I will explain it rather than forcing the path live.

Boss fight goes badly:

> Losing is meaningful because it costs resources. The risk is part of the economy.

Need to use video:

> I will switch to the short video only to show the full path; the same behavior is implemented in the playable build.

## Team Q&A Routing

- He Yufeng: AI architecture, state validation, overall design, integration.
- Xu Junjie: dialogue and player interaction fixes.
- Yu Erfei: boss dungeon, day scaling, sound effects, combat polish.
- Long Huzhiyuan: 3D preview, rendering, UI panel, visual polish.

## Must Not Forget

- Do not spend too long in tutorial.
- Do not wait silently during LLM calls.
- Do not over-explain the report.
- Do not promise the executable package; submit/rerun the source package.
- Leave time for teacher questions.
