# Live Gameplay Demo Script

Presentation mode: **play the game live**. Do not walk through the report or PPT.
Use the screen as the structure. Speak naturally; the text below is a cue card,
not something to read word for word.

Target: 6-7 minutes.

## Demo Route

1. Title screen -> `NEW GAME`.
2. Close/skim tutorial.
3. Point out HUD: day, resources, coins, trade slots, phase, daily event.
4. Move with `WASD`.
5. Do labor with `E` near fishing/farming.
6. Talk to one NPC and send a message.
7. While LLM thinks, explain optimistic UI and server validation.
8. End turn and show AI actions / event log.
9. If possible, enter dungeon and show 20-40 seconds of combat.
10. Close with the architecture sentence.

## 0:00-0:25 - Start

Action:

- Show title screen.
- Click `NEW GAME`.

Say:

> Good morning. I will present this project by playing it directly.
>
> This is Island Escape, a survival trading game with LLM-driven NPCs. The goal
> is to survive on the island and become the first character to collect 100
> coins and escape.
>
> What we are demonstrating is not just a chat interface. It is a game economy
> where conversation, resources, and risk are connected.

## 0:25-1:05 - First Screen

Action:

- On the game screen, point to resources, coins, day, phase hint, trade slots,
  daily event badge if present, and NPCs.
- Close the tutorial if it blocks the map.

Say:

> Here is the main game loop. I have fish, wheat, and coins. Fish and wheat keep
> me alive at night; coins are the escape objective.
>
> Each day has a rhythm: first labor, then trade, then the AI characters act,
> then settlement happens. The game is intentionally readable, so the audience
> can follow the decisions while I play.

Optional if daily event is visible:

> This badge is today's event. Events such as storm, festival, lucky catch, and
> drought change the economy, but they are still deterministic rules controlled
> by the game engine.

## 1:05-1:45 - Movement And Labor

Action:

- Move with `WASD`.
- Walk to fishing or farming.
- Press `E` to interact.
- Prefer fishing if nearby because it is fast.

Say:

> I move with WASD. Before trading, I must do labor.
>
> Fishing gives immediate fish. Farming gives delayed wheat. So even this first
> step has a small survival decision: do I secure today or invest for later?
>
> I will fish here so we can enter the trade phase quickly.

After labor:

> Now the phase changed to trade. This phase system is important. The UI guides
> the player, but the backend is the actual source of truth and rejects illegal
> actions.

## 1:45-3:10 - NPC Negotiation

Action:

- Walk to an NPC.
- Press `E` to open dialogue.
- Send one short message. Good examples:

```text
I need wheat to survive tonight. Can you help me? I can offer fish if the deal is fair.
```

or:

```text
I want to build an alliance. What would you trade for one fish?
```

Say before sending:

> Now I will negotiate with an NPC. This is where the LLM is useful: the
> character can respond with personality, not just a fixed menu.
>
> But the model does not directly edit the game state. It can speak, propose,
> accept, or reject, while the server validates whether the trade is actually
> legal.

Say while waiting:

> The thinking state matters. Earlier, an LLM delay could look like the game was
> frozen. Now my message appears immediately, and the NPC response arrives when
> the backend finishes the model call.
>
> This makes model latency visible instead of confusing.

Say after response:

> The text is generated, but the resource ledger is still deterministic. If a
> trade happens, the server checks both sides' fish, wheat, coins, phase, and
> trade slots before applying it.

If the LLM is too slow:

> If the model is slow today, the important point is still visible here: the UI
> keeps the interaction pending instead of silently failing, and the rest of the
> game state remains stable.

## 3:10-3:50 - Trade Slots And Merchant

Action:

- If near merchant, show merchant interaction.
- Otherwise point to trade slots and explain merchant selling.

Say:

> Trade slots are the daily action budget. Talking to NPCs, selling to the
> merchant, and entering the dungeon all compete for the same limited resource.
>
> This is what makes the AI interaction part of a game. Conversation is not
> unlimited chat; it has an economic cost.

## 3:50-4:40 - End Turn And AI Turns

Action:

- Click `End Turn`.
- Let AI actions run for a short time.
- Point to movement, event log, and resource changes.

Say:

> I will end my turn so the AI islanders can act.
>
> Each AI also needs to labor and then decide how to use trade slots. The LLM can
> help decide intention, but the same game rules still apply to every character.
>
> The event log and animations are here so AI behavior does not feel hidden. You
> can see that the island is still moving even when the player is waiting.

## 4:40-5:55 - Boss Dungeon

Action:

- If in trade phase and close enough, enter dungeon.
- Show movement, auto/combat shooting, minions, boss warning, XP/cards.
- Mention controls: `WASD` move, `Space` flash, `Q` ultimate.
- Do not try to finish the whole fight unless it is going well.

Say:

> The dungeon is the final gameplay extension. It gives the demo a more active
> moment, but it is still tied to the island economy.
>
> Entering costs one trade slot and can happen only once per day. Winning gives
> coins; losing costs resources. So this is a risk-reward decision, not a
> separate arcade mode.
>
> The boss also scales with the day. Earlier runs are safer but pay less. Later
> runs reward more coins but the boss becomes harder.

If sound is on:

> We also added sound feedback for combat, so hits, attacks, and dungeon events
> are easier to read during a live demo.

If you cannot reach dungeon in time:

> I will not force the full dungeon path live, because the day flow can take
> longer depending on the model. The important design is that dungeon entry is a
> trade-phase choice with a reward and a penalty, so it connects back to the
> survival economy.

## 5:55-6:40 - Architecture While Game Is Visible

Action:

- Keep playing or leave the current game screen visible.

Say:

> The core engineering idea is separation of responsibilities.
>
> The frontend renders the island, dialogue UI, 3D preview, combat, and sound.
> The backend owns the game state, validation, persistence, and AI calls. Shared
> schemas define the contract between the two.
>
> So the model creates social behavior and language, but typed deterministic
> code owns fairness and correctness.

## 6:40-7:00 - Closing

Say:

> In short, Island Escape is a playable AI negotiation game. The player survives
> through resources, competes through trade, and interacts with NPCs that feel
> more like agents than menus.
>
> Thank you.

## If Something Goes Wrong

LLM response is slow:

> This delay is expected because the NPC is generated by an external model. The
> important part is that the UI shows a pending state and the backend keeps the
> game state safe.

Cannot find an NPC quickly:

> The island is spatial on purpose. Interaction depends on where the player is,
> so movement is part of the negotiation loop rather than a separate menu.

Cannot enter dungeon:

> Dungeon is only available during the trade phase and costs a trade slot. That
> restriction is intentional because it makes combat part of the economy.

Boss fight goes badly:

> Losing is also part of the design. It costs resources, so the player has to
> decide whether the coin reward is worth the survival risk.

Need to stop at 3 minutes:

> The shortest summary is: labor creates resources, trading turns resources into
> coins, LLM NPCs make negotiation dynamic, and the backend keeps all game rules
> deterministic.

## One-Sentence Answers For Questions

Why use an LLM?

> Because negotiation and personality are exactly where fixed menus feel weak.

Why not let the LLM control everything?

> Because game state must be fair, testable, and recoverable, so the LLM only
> proposes behavior while the engine validates rules.

What is the boss for?

> It adds a high-energy risk-reward path to coins without replacing the survival
> trading loop.

What was the hardest engineering part?

> Keeping asynchronous LLM behavior responsive in the UI while preserving a
> server-authoritative state machine.
