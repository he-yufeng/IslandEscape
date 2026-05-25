# Island Escape Live Gameplay Script

Mode: **play the game live**. Do not present the report. Do not walk through the
PPT unless the teacher asks for it. Use the screen as the structure.

Target length: 5-7 minutes, then stop and let the teacher ask questions.

## Presenter Mindset

The strongest version of this presentation is not "we built an AI chatbot".
The strongest version is:

> We built a playable survival economy where LLM agents create negotiation and
> personality, while deterministic game code keeps the rules fair.

Keep returning to that idea while playing.

Do not over-explain every system. Show one good example of each:

- movement and spatial interaction;
- labor and resource pressure;
- NPC negotiation;
- AI turn / event log;
- dungeon risk-reward if it is quick to reach;
- backend validation and model separation.

## Team Split If Asked

- He Yufeng: live demo, AI architecture, backend validation, integration.
- Xu Junjie: dialogue flow, player interaction fixes, UI experience.
- Yu Erfei: boss dungeon, day scaling, combat polish, sound effects.
- Long Huzhiyuan: 3D preview, rendering, UI panel, visual polish.

If the teacher asks "who did what", answer in one sentence and continue playing.

## Live Route

1. Title screen -> `NEW GAME`.
2. Show the HUD: day, fish, wheat, coins, trade slots, phase, daily event.
3. Move with `WASD`.
4. Press `E` near a labor target.
5. Talk to one NPC and send a short message.
6. While the NPC thinks, explain model latency and state safety.
7. End turn and show AI actions / event log.
8. Show dungeon only if the path is quick.
9. Close with the architecture sentence.
10. Stop and take questions.

## 0:00-0:20 - Opening

Action:

- Start from the title screen.
- Click `NEW GAME`.

Say:

> Good morning. I will present this by playing the game directly, because the
> main contribution is the interaction loop.
>
> This is Island Escape. The goal is simple: survive on the island, trade with
> other characters, and become the first one to collect 100 coins and escape.
>
> The part I care about most is that this is not just a chatbot with a game
> background. It is a small survival economy where conversation changes actual
> decisions.

If the teacher says to just play:

> Sure. I will keep the explanation short and talk only about what is happening
> on screen.

## 0:20-0:55 - Explain The Screen

Action:

- Point to the HUD while moving lightly.
- Mention resources, coins, phase, trade slots, and daily event.

Say:

> Here, fish and wheat are survival resources. Every character needs them at
> night. Coins are the win condition.
>
> The day is split into phases. First I need to do labor, then I can trade, then
> the AI characters take their turns, and finally the day settles.
>
> The trade slots are important. They make negotiation a real game decision,
> because talking, selling, and entering the dungeon all compete for the same
> limited budget.

If a daily event is visible:

> This event changes today's economy. It is not LLM narration; it is a rule in
> the game engine, so the result is predictable and testable.

## 0:55-1:35 - Movement And Labor

Action:

- Move with `WASD`.
- Walk to fishing or farming.
- Press `E`.
- Prefer fishing if nearby because it resolves immediately.

Say:

> Movement is deliberately spatial. I need to walk to a place or a character
> before interacting, instead of doing everything from a menu.
>
> I will fish here because it gives immediate resources and gets us into the
> trade phase quickly.
>
> This first step already creates a small tradeoff: fishing helps today, farming
> is slower but supports later survival.

After labor:

> Now the phase changes to trade. The frontend guides me, but the backend is the
> source of truth. If I try an illegal action, the server rejects it rather than
> trusting the UI.

## 1:35-3:00 - NPC Negotiation

Action:

- Walk to one NPC.
- Press `E`.
- Send one short message.

Recommended message:

```text
I need wheat to survive tonight. Can you help me? I can offer fish if the deal is fair.
```

Alternative if you want alliance flavor:

```text
I want to build an alliance. What would you trade for one fish?
```

Say before sending:

> This is the LLM part. Each NPC has a personality, so the response is not just
> a fixed button menu.
>
> But I do not let the model own the game state. The model can speak and suggest
> an intention. The server still validates resources, phase, trade slots, and
> whether the deal is legal.

Say while waiting:

> There is always some latency because this calls an external model. We made the
> pending state visible so the player knows the game is thinking instead of
> frozen.
>
> From an engineering point of view, that was important: asynchronous AI should
> feel like part of the interface, not like the UI has broken.

Say after response:

> The personality comes from the model, but the resource ledger is deterministic.
> That separation is the main design principle: AI gives behavior; the engine
> keeps fairness.

If the LLM is too slow:

> I will not wait silently for the model. The key point is that the game keeps
> the message pending and the backend state remains safe while the model call is
> running.

If the NPC refuses:

> A refusal is also useful. The NPC is not only a vending machine; it can protect
> its own resources or bargain based on personality.

## 3:00-3:45 - Merchant / Trade Slots

Action:

- If near merchant, interact with merchant.
- If not, point to trade slots and explain the merchant role.

Say:

> The merchant is the stable economic route: selling resources turns survival
> goods into coins.
>
> NPC negotiation is less predictable, but can be strategically better. That is
> why the AI matters: it creates a social layer on top of the economy.
>
> Every trade action costs a slot, so I cannot just talk forever. The game forces
> me to choose what is worth spending time on.

## 3:45-4:40 - End Turn And AI Actions

Action:

- Click `End Turn`.
- Let AI actions run.
- Point to the event log and any movement/resource changes.

Say:

> I will end my turn now so the AI islanders act.
>
> They go through the same structure: labor, trade decisions, then settlement.
> The important part is that the AI characters are not exempt from the rules.
> They use the same economy as the player.
>
> The event log is here because AI behavior should be inspectable. Even if the
> character logic is partly generated, the player can still see what happened.

If AI turn takes time:

> I will use this moment to point out that we intentionally keep the game state
> server-authoritative. Even during AI turns, the frontend is just displaying
> the result of validated backend actions.

## 4:40-5:55 - Dungeon, If Available

Action:

- Enter dungeon only if it is quick.
- Show movement, attacks, sound, `Space`, and `Q`.
- Do not force a full boss clear if the fight is messy.

Say:

> The dungeon is our final gameplay extension. It gives the demo a more active
> moment, but it is still connected to the island economy.
>
> Entering costs a trade slot. Winning gives coins. Losing costs resources. So
> it is a risk-reward shortcut, not a separate mini-game pasted on top.
>
> The boss also scales with the day. Earlier attempts are safer but pay less;
> later attempts are more rewarding but harder.

If sound is on:

> The sound effects make the combat easier to read live. You can hear hits,
> attacks, and feedback without needing me to explain every frame.

If dungeon is not available:

> I will not force the dungeon path here because it depends on the phase and
> trade slots. The important design is that dungeon entry competes with trading,
> so combat is another economic choice.

## 5:55-6:35 - Architecture Close

Action:

- Keep the game screen visible.
- Do not switch to slides.

Say:

> The architecture is split very deliberately.
>
> The frontend handles the island, interaction UI, 3D preview, dungeon, and
> sound. The backend owns the state machine, validation, persistence, and model
> calls. Shared schemas keep the API contract typed across both sides.
>
> So the model is used where it is strong: language, personality, and intention.
> The deterministic engine is used where it is necessary: fairness, resource
> accounting, and game rules.

## 6:35-6:55 - Final Sentence

Say:

> That is the core of Island Escape: a playable AI negotiation game where
> resources create pressure, LLM agents create social behavior, and the backend
> keeps the game fair.
>
> Thank you. I am happy to answer questions.

Then stop. Do not keep explaining unless asked.

## If The Teacher Asks About PPT Or Report

If asked whether there is a PPT:

> Yes, we prepared one as backup, but I think the clearest way to evaluate this
> project is to play it and see the loop directly.

If asked why not walk through the report:

> The report explains the design in detail. For this presentation, I want to use
> the playable build as the evidence.

If the live demo breaks:

> I can switch to the short demo video to show the intended full path. The same
> behavior is implemented in the submitted source package.

## Short Version If Time Is Cut To 3 Minutes

Say this while playing:

> The shortest summary is: labor creates resources, trade converts resources
> into strategy, LLM NPCs make negotiation dynamic, and the backend validates
> every state change.
>
> The model does not control the whole game. It creates social behavior inside a
> deterministic game engine.

Then show:

1. `NEW GAME`.
2. Labor once.
3. Send one NPC message.
4. End turn.
5. Mention dungeon as the risk-reward extension.

## Fast Q&A Answers

Why use an LLM?

> Because negotiation and personality are where fixed menus feel weakest. The
> LLM makes the NPC feel less like a shop and more like another islander.

Why not let the LLM control everything?

> Because game state needs to be fair and testable. The LLM can propose behavior,
> but the engine validates the result.

What was the hardest engineering part?

> Making asynchronous model calls feel responsive while keeping the server as
> the source of truth.

What does the dungeon add?

> It adds a high-energy risk-reward path to coins, while still using the same
> trade-slot economy.

What do daily events do?

> They add variation to the economy without making the rules arbitrary.

What should we evaluate first?

> Whether the loop is playable: labor, negotiation, trade slots, AI actions, and
> deterministic validation.

What if the model gives a weird answer?

> The text may vary, but the game state is protected. A weird sentence does not
> automatically create an illegal trade.

What is the main technical takeaway?

> AI should create behavior, not replace the game engine.
