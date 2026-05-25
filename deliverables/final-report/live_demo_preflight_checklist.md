# Live Demo Preflight Checklist

Use this 10-15 minutes before presenting. The presentation should be the live
game first; report, PPT, and video are backup material.

## Files To Have Ready

- Playable source zip:
  `C:\Users\He\Desktop\GAMEDESIGN\PROJECT\IslandEscape-teacher-playable-source.zip`
- Final report PDF:
  `deliverables/final-report/Report.pdf`
- Backup demo video:
  `deliverables/final-report/IslandEscape.mp4`
- Backup PPT:
  `deliverables/final-report/IslandEscape_Final.pptx`
- Presenter cue card:
  `deliverables/final-report/live_demo_one_page_card.md`

## Local Run Check

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173 and verify:

- `NEW GAME` creates a game.
- WASD movement works.
- `E` interaction works near a labor target.
- At least one NPC message can be sent.
- End turn advances into AI actions.
- Sound is not painfully loud if the dungeon is shown.

## Environment Check

- `.env` exists locally.
- `.env` is not committed and is not inside the source zip.
- `OPENAI_API_KEY` is present locally.
- `OPENAI_BASE_URL` and `OPENAI_MODEL` match the intended provider.
- Browser tab, terminal, backup video, and PPT are already open before the demo.

## Live Demo Route

1. Start at the title screen.
2. Click `NEW GAME`.
3. Explain the HUD quickly.
4. Move with `WASD`.
5. Labor with `E`.
6. Talk to one NPC.
7. Explain LLM latency while the NPC thinks.
8. End turn and show AI actions.
9. Show dungeon only if it is quick to reach.
10. Stop and let the teacher ask questions.

## If Something Breaks

- `NEW GAME` fails: restart `pnpm dev` and confirm backend port `8787`.
- NPC reply is slow: explain external API latency and keep talking.
- Dungeon path is not ready: skip it live and mention the backup video.
- Browser is stale: hard refresh.
- Live demo fails completely: play `IslandEscape.mp4`, then state that the
  submitted source package contains the same playable implementation.

## Speaking Rule

Keep the first answer short:

> I will present by playing the game directly. The goal is to survive, trade,
> and become the first character to collect 100 coins.

After that, talk only about what is visible on screen unless the teacher asks a
technical question.
