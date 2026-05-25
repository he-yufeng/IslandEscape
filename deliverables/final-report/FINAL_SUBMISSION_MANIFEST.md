# Final Submission Manifest

Use this as the final sanity check before uploading.

## Recommended Submission Files

If the platform accepts one archive, submit:

- `IslandEscape_Final.zip`

Current contents:

- `IslandEscape-teacher-playable-source.zip` - runnable source package.
- `IslandEscape.mp4` - 2-minute demo video.
- `IslandEscape_Final.pptx` - presentation deck.
- `Report.pdf` - final report PDF.
- `FINAL_SUBMISSION_MANIFEST.md` - this upload checklist.

If the platform asks for separate files, submit the four core files separately:
source zip, video, PPT, and report. The manifest is only a checklist.

## Current File Sizes

- `IslandEscape_Final.zip`: about 49 MB.
- `IslandEscape-teacher-playable-source.zip`: about 0.8 MB.
- `IslandEscape.mp4`: about 22.4 MB.
- `IslandEscape_Final.pptx`: about 25.9 MB.
- `Report.pdf`: about 0.4 MB.

All are below the 100 MB package limit.

## Source Package Rule

The source package should stay code-only. It must not include:

- report files;
- PPT files;
- videos;
- `.env`;
- API keys;
- `node_modules`;
- local logs.

The source package is intentionally small because dependencies are restored from
`pnpm-lock.yaml` with `pnpm install`.

## Run Instructions For Teacher

Inside the extracted source package:

```bash
corepack enable pnpm
corepack use pnpm@latest-10
pnpm install
cp .env.example .env
pnpm dev
```

Then open:

- `http://localhost:5173`

For single-process production-style running:

```bash
pnpm build
pnpm start
```

## Presentation Order

Use this flow:

1. PPT: 3-4 minutes.
2. Demo video: about 2 minutes.
3. Live game proof: 1-2 minutes.

Do not spend the whole presentation waiting for model calls during live play.
The video shows the full intended flow; the live build proves it is runnable.

## Last-Minute Checks

- Local game opens.
- `NEW GAME` works.
- API key is only in local `.env`, not in submitted files.
- PPT and video are open before presenting.
- If live model response is slow, say the video already showed the complete
  path and move on.
