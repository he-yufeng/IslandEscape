# Final Presentation Preflight Checklist

Use this 10-15 minutes before presenting. The intended order is PPT first, demo
video second, and a short live game proof at the end.

## Files To Have Ready

- Playable source zip:
  `C:\Users\He\Desktop\GAMEDESIGN\PROJECT\IslandEscape-teacher-playable-source.zip`
- Final report PDF:
  `deliverables/final-report/Report.pdf`
- Demo video:
  `deliverables/final-report/IslandEscape.mp4`
- PPT:
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
- Browser tab, terminal, video, and PPT are already open before presenting.

## Presentation Route

1. PPT: 3-4 minutes.
2. Video: about 2 minutes.
3. Live game: 1-2 minutes.
4. Stop and let the teacher ask questions.

## Live Game Route

1. Open the running game.
2. Click `NEW GAME`.
3. Move with `WASD`.
4. Press `E` near one target.
5. Send one NPC message only if it is quick.
6. Stop before waiting too long.

## If Something Breaks

- `NEW GAME` fails: restart `pnpm dev` and confirm backend port `8787`.
- NPC reply is slow: say the video already showed the full path and move on.
- Dungeon path is not ready: do not force it live; the video covers it.
- Browser is stale: hard refresh.
- Live demo fails completely: play `IslandEscape.mp4`, then state that the
  submitted source package contains the same playable implementation.

## Speaking Rule

Keep the first answer short:

> I will first use the PPT to explain the design, then show the short video for
> the complete flow, and finally open the live build briefly.

During the live game, talk only about what is visible on screen unless the
teacher asks a technical question.
