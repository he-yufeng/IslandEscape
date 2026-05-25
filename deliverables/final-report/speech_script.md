# Island Escape Final Presentation Script

Mode: **PPT first, video second, short live play last**.

Target length: 6-7 minutes total.

- PPT: 3-4 minutes.
- Video: about 2 minutes.
- Live game: 1-2 minutes.

Do not turn this into a report reading. The PPT gives structure, the video proves
the full flow, and the final live play proves the build is real and runnable.

## Core Message

> Island Escape is a playable AI negotiation game. Resources create survival
> pressure, LLM agents create social behavior, and deterministic backend code
> keeps the game fair.

Keep this sentence in mind. Every slide should support it.

## Team Split If Asked

- He Yufeng: overall design, AI architecture, backend validation, integration,
  final presentation.
- Xu Junjie: dialogue flow, interaction fixes, player-facing experience.
- Yu Erfei: boss dungeon, day-scaled difficulty, combat polish, sound effects.
- Long Huzhiyuan: 3D preview, rendering, UI panel, visual polish.

If the teacher asks about contribution split, answer briefly and return to the
project.

## 0:00-0:25 - Opening Slide

Say:

> Good morning. Our project is Island Escape, a survival trading game with
> LLM-driven NPCs.
>
> The goal is simple: the player must survive on the island, trade with other
> characters, and become the first one to collect 100 coins and escape.
>
> The main point is that this is not just a chatbot with a map. We tried to make
> conversation part of an actual game economy.

## 0:25-0:55 - Problem And Design Goal

Use the slide about concept / motivation.

Say:

> In many AI game demos, the AI is interesting but the game loop is weak. In
> many traditional games, the loop is clear but NPC dialogue is fixed.
>
> Our design goal was to combine the two: keep the rules deterministic, but make
> negotiation more flexible through LLM agents.
>
> So the player is not only clicking menu options. They are making resource
> decisions, spending trade slots, and talking to NPCs with different
> personalities.

## 0:55-1:35 - Gameplay Loop Slide

Use the slide showing labor, trade, AI turn, settlement, win condition.

Say:

> The game loop is day-based.
>
> First, the player must labor. Fishing gives immediate fish; farming gives
> delayed wheat. Then the player enters the trade phase, where they can sell to
> the merchant, negotiate with NPCs, or enter the dungeon.
>
> After that, AI characters take their own turns, and everyone consumes
> resources at night.
>
> This is important because every AI interaction has a cost. Talking is not
> unlimited chat; it uses the same trade-slot economy as the rest of the game.

## 1:35-2:15 - AI Negotiation Slide

Use the slide about LLM NPCs / personalities / dialogue.

Say:

> The LLM is used where it is strong: language, personality, and intention.
>
> Each NPC can respond differently. A cooperative character may help the player,
> while a more opportunistic character may bargain harder or refuse.
>
> But the model does not directly edit the game state. It can propose or respond,
> while the server checks whether the trade is legal.
>
> This separation is the main engineering decision: AI creates social behavior,
> but the backend owns truth.

## 2:15-2:55 - Architecture / Validation Slide

Use the slide showing frontend, backend, shared schemas, model call.

Say:

> Technically, the frontend handles the island, interaction UI, 3D preview,
> dungeon, and sound.
>
> The backend owns the state machine, validation, persistence, and model calls.
> Shared Zod schemas define the contract between frontend and backend.
>
> This avoids a common problem in LLM games: the model may say something
> creative, but it cannot invent illegal resources or bypass phase rules. The
> deterministic engine still checks fish, wheat, coins, trade slots, and phase.

## 2:55-3:35 - Polish / Extension Slide

Use the slide about 3D preview, dungeon, sound, and final polish.

Say:

> For the final version, we also added more visible gameplay polish.
>
> The 3D preview and UI panel make interactions easier to read. The dungeon adds
> a more active risk-reward path: entering costs a trade slot, winning gives
> coins, and losing costs resources.
>
> We also added combat feedback and sound effects, because in a live demo the
> audience needs to understand what is happening quickly.

Transition to video:

> I will now play the short video. It shows the full intended flow more smoothly
> than waiting for every model call live.

## 3:35-5:35 - Demo Video

Do not narrate every frame. Use short comments while the video runs.

At the start of the video:

> Here you can see the title screen, the main island, and the HUD. The important
> information is always visible: resources, coins, day, phase, and trade slots.

When labor appears:

> This is the labor step. The player has to create resources before trading, so
> the economy starts from survival pressure.

When NPC dialogue appears:

> This is the negotiation step. The player can send natural language, but the
> outcome is still validated by the backend.

When AI actions / event log appear:

> After the player turn, the AI characters also act under the same rules. The log
> makes those decisions visible instead of hiding them as black-box AI behavior.

When dungeon / boss appears:

> This is the dungeon extension. It gives the game a high-energy moment, but it
> is still connected to the economy through trade slots, rewards, and penalties.

At the end of the video:

> So the video shows the complete path: survival, negotiation, AI turns, and the
> dungeon risk-reward extension.

## 5:35-6:50 - Short Live Game Proof

Purpose: do not replay the whole video. Just prove the submitted build is real.

Action route:

1. Open the running game.
2. Click `NEW GAME`.
3. Move with `WASD`.
4. Press `E` near one interaction target.
5. If fast, send one NPC message.
6. Stop before waiting too long.

Say:

> I will quickly show the live build as well, just to show that this is runnable
> and not only a recorded video.
>
> Here I start a new game, move around the island, and interact with the world.
>
> If I talk to an NPC, the response may take a moment because it calls an
> external model. The important part is that the UI shows the pending state, and
> the backend keeps the game state safe.

If the live model call is slow:

> I will not wait for the full response here because the video already showed
> the complete path. The key point is that the same interaction is running in
> the live build.

If live demo fails:

> The live server is being temperamental, so I will rely on the video for the
> full path. The submitted source package contains the runnable implementation,
> and we validated the build and API locally.

## 6:50-7:00 - Closing

Say:

> To summarize, Island Escape uses AI where it adds value: social behavior and
> negotiation. But the actual game remains deterministic and playable, with
> clear resources, phases, validation, and win conditions.
>
> Thank you. I am happy to answer questions.

Then stop.

## If Time Is Cut

If you only have 5 minutes:

- PPT: 2 minutes.
- Video: 2 minutes.
- Live game: 30-45 seconds.

Short version:

> The shortest summary is: labor creates resources, trading converts resources
> into strategy, LLM NPCs make negotiation dynamic, and the backend validates
> every state change.

## Fast Q&A Answers

Why use an LLM?

> Because negotiation and personality are where fixed menus feel weakest.

Why not let the LLM control everything?

> Because game state must be fair and testable. The LLM can propose behavior,
> but the engine validates the result.

What did the video show that live play may not show?

> The full flow without waiting for model latency: labor, negotiation, AI turns,
> and dungeon combat.

What is the main technical contribution?

> Separating generated social behavior from deterministic game-state validation.

What does the dungeon add?

> It adds a high-energy risk-reward route to coins without replacing the
> survival trading loop.

What should we evaluate first?

> Whether the loop is playable and coherent: resources, trade slots, AI
> negotiation, visible AI actions, and backend validation.
