# Island Escape Final Presentation Script

Mode: **PPT first, video second, short live play last**.

Target: about 7 minutes.

- PPT: 3-4 minutes.
- Video: about 2 minutes.
- Live game proof: 1-2 minutes.

Do not read this word for word. Use it as a rhythm guide. The tone should be:
confident, concrete, and slightly conversational.

## One Core Sentence

> Island Escape is a playable AI negotiation game: resources create survival
> pressure, LLM agents create social behavior, and deterministic backend code
> keeps the game fair.

If you get nervous, return to this sentence.

## Team Split If Asked

- He Yufeng: overall design, AI architecture, backend validation, integration,
  final presentation.
- Xu Junjie: dialogue flow, interaction fixes, player-facing experience.
- Yu Erfei: boss dungeon, day-scaled difficulty, combat polish, sound effects.
- Long Huzhiyuan: 3D preview, rendering, UI panel, visual polish.

Keep this short. Do not turn contribution split into a second presentation.

## Slide 1 - Opening

Time: 0:00-0:25

Say:

> Good morning. Our project is Island Escape, a survival trading game with
> LLM-driven NPCs.
>
> The player is stranded on an island. To escape, they need to survive, trade
> with other characters, and become the first one to collect 100 coins.
>
> The main idea is simple: we wanted AI dialogue to affect a real game loop, not
> just appear as a chatbot panel beside the game.

## Slide 2 - Core Game Loop

Time: 0:25-1:05

Say:

> The game is organized around a daily loop: labor, trade, AI turns, and
> settlement.
>
> Fish and wheat keep characters alive. Coins are the escape objective. Trade
> slots are the daily action budget.
>
> This is the reason the negotiation matters. Talking to an NPC is not free
> infinite chat. It competes with selling to the merchant and entering the
> dungeon, so conversation becomes part of the economy.

Small optional line if you need to slow down:

> In other words, every dialogue choice has a resource context.

## Slide 3 - Why LLM Agents Fit

Time: 1:05-1:40

Say:

> We use the LLM where fixed rules are weakest: intention, dialogue,
> personality, and bargaining style.
>
> But the model does not own the game state. It cannot simply invent resources,
> skip phases, or force an illegal trade.
>
> That is the main engineering boundary: the model creates expression, while
> the typed game engine owns the rules.

## Slide 4 - NPC Negotiation Flow

Time: 1:40-2:15

Say:

> This is the player-facing negotiation flow.
>
> The player sends a natural-language message. The NPC thinks, then responds
> with personality and possibly a proposal.
>
> We added a visible pending state because model calls can take time. Without
> that, latency feels like the game is frozen. With it, latency becomes an
> understandable part of the interaction.

If you want one extra engineering sentence:

> The generated text can vary, but the final trade still goes through server
> validation.

## Slide 5 - Engineering Architecture

Time: 2:15-2:55

Say:

> The architecture is deliberately split.
>
> The frontend handles the island, PixiJS rendering, interaction UI, 3D preview,
> dungeon, and sound feedback.
>
> The backend owns the state machine, validation, persistence, and model calls.
> Shared Zod schemas keep the frontend and backend contract typed.
>
> This makes the project much safer: the LLM can be creative in language, but
> deterministic code still checks fish, wheat, coins, phase, and trade slots.

## Slide 6 - Boss Dungeon And Polish

Time: 2:55-3:30

Say:

> For the final version, we added more visible gameplay polish.
>
> The boss dungeon gives the demo a more active moment, but it is still tied to
> the island economy. Entering costs a trade slot. Winning gives coins. Losing
> costs resources.
>
> So the dungeon is not a separate arcade mode. It is a risk-reward shortcut
> inside the same survival system.
>
> Sound effects and visual feedback were added so combat is easier to read in a
> live presentation.

## Slide 7 - Video Setup

Time: 3:30-3:40

Say:

> I will now play the short demo video. It shows the full intended flow more
> smoothly than waiting for every model call live.

Then start the video.

## Demo Video Voiceover

Time: 3:40-5:40

Do not narrate every frame. Use 3-5 short comments.

At title / main island:

> Here you can see the title screen, the island, and the HUD. The key
> information is always visible: resources, coins, day, phase, and trade slots.

At labor:

> This is the labor step. The player has to create survival resources before
> they can start trading.

At NPC dialogue:

> This is the negotiation step. The player can use natural language, but the
> backend still validates the actual trade.

At AI turn:

> After the player turn, AI characters also act under the same rules. The event
> log makes those actions visible instead of hiding them as black-box behavior.

At dungeon / boss:

> This is the dungeon extension. It adds a high-energy risk-reward route to
> coins, but it still depends on trade slots and resources.

At the end:

> So the video shows the full path: survival pressure, negotiation, AI turns,
> and the dungeon extension.

## Slide 8 - Validation, Team, Next Steps

Time: 5:40-6:15

Say:

> Finally, we kept validation in the loop. The final project passed lint,
> typecheck, unit tests, and build locally.
>
> The main limitation is still model latency. That is why the interface needs a
> clear thinking state, and why the demo video is useful for showing the full
> path without waiting.
>
> If we continued the project, I would focus on deeper agent memory, better
> balance tuning, and tighter links between the island economy and the dungeon.

If the teacher asks about team roles here, use the team split above.

## Short Live Game Proof

Time: 6:15-7:00

Purpose: prove the build is real. Do not replay the whole video.

Action route:

1. Open the running game.
2. Click `NEW GAME`.
3. Move with `WASD`.
4. Press `E` near one interaction target.
5. Send one NPC message only if it is quick.
6. Stop before waiting too long.

Say:

> I will quickly show the live build as well, just to show that this is runnable
> and not only a recorded video.
>
> Here I start a new game, move around the island, and interact with the world.
>
> If I talk to an NPC, the response may take a moment because it calls an
> external model. The video already showed the full path, so I will not wait too
> long here.

Closing:

> To summarize, Island Escape uses AI where it adds value: social behavior and
> negotiation. But the actual game remains deterministic and playable, with
> clear resources, phases, validation, and win conditions.
>
> Thank you. I am happy to answer questions.

Then stop. Let the teacher ask.

## If Something Goes Wrong

Video does not play:

> The video file is also submitted with the package. I will continue with the
> PPT and then show the live build.

Live game is slow:

> I will not wait for the full model response here because the video already
> showed the complete path. The key point is that this is the same live build.

Live server fails:

> The live server is being temperamental, so I will rely on the video for the
> full path. The submitted source package contains the runnable implementation,
> and we validated the build and API locally.

Time is cut to 5 minutes:

> The shortest summary is: labor creates resources, trading converts resources
> into strategy, LLM NPCs make negotiation dynamic, and the backend validates
> every state change.

Then do: Slide 1 -> Slide 2 -> Slide 5 -> Video -> one live `NEW GAME`.

## Fast Q&A Answers

Why use an LLM?

> Because negotiation and personality are where fixed menus feel weakest.

Why not let the LLM control everything?

> Because game state must be fair and testable. The LLM can propose behavior,
> but the engine validates the result.

What is the main technical contribution?

> Separating generated social behavior from deterministic game-state validation.

What did the video show that live play may not show?

> The full flow without waiting for model latency: labor, negotiation, AI turns,
> and dungeon combat.

What does the dungeon add?

> It adds a high-energy risk-reward route to coins without replacing the
> survival trading loop.

What should we evaluate first?

> Whether the loop is coherent and playable: resources, trade slots, AI
> negotiation, visible AI actions, and backend validation.
