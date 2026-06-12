# Contributing

TrackTag is a personal tool first, but issues and PRs are welcome.

## Stack

Electron (electron-vite) + React 19 + TypeScript + Tailwind v4. Packaging via electron-builder. The app is macOS-only (Apple Silicon) and ships unsigned.

## Setup

Requires macOS on Apple Silicon and Node 22+.

```bash
git clone https://github.com/lebuckman/tracktag.git
cd tracktag
npm install     # also stages ffmpeg and downloads the latest yt-dlp into resources/bin
npm run dev     # dev app with HMR
```

Autofill needs a Gemini API key, entered on the app's first-run screen (free at [aistudio.google.com](https://aistudio.google.com/apikey)). Everything else works without it.

Useful scripts:

```bash
npm run typecheck    # tsc over main + renderer
npm run lint         # eslint + prettier rules
npm run dist         # build the unsigned DMG into dist/
npm run fetch-binaries -- --force   # re-download yt-dlp
```

Open the dev app with `#sink` in the URL hash for a gallery of every UI primitive (dev builds only).

## Project layout

```
src/main/      Electron main process: window, IPC handlers, yt-dlp/ffmpeg/ID3/Gemini pipeline
src/preload/   context-bridge exposing the typed window.api surface
src/renderer/  the React app
src/shared/    types and pure helpers used by both sides
resources/bin/ staged binaries (git-ignored, created by npm install)
```

The renderer is sandboxed and everything system-side (downloads, ffmpeg, tagging, the Gemini call, settings) goes through `window.api`, the typed IPC bridge defined in `src/shared/types.ts`. The Gemini key lives in the main process store and never ships anywhere.

## Conventions

- Conventional commits, `tracktag` scope: `feat(tracktag): …`, `fix(tracktag): …`. Brief subjects; body only when something non-obvious needs explaining.
- Linear history on `main`. Work on a branch, then merge without a merge commit (rebase or fast-forward).
- Run `npm run typecheck && npm run lint` before pushing.
- Some patterns look odd on purpose (persistent toasts with stable IDs, the autofill typewriter's ref dance, trim always going through ffmpeg). If something seems cleanable, check the comment next to it first.

## Releasing

Releases are manual and cut from `main`:

1. Bump `version` in `package.json` (semver).
2. `npm run dist` to produce `dist/TrackTag.dmg`.
3. Smoke test the packaged app: launch, paste a URL, save a file.
4. Tag and publish:

   ```bash
   git tag v1.x.x
   git push origin main --tags
   gh release create v1.x.x dist/TrackTag.dmg --title "v1.x.x" --notes "what changed"
   ```

The README download button always points at the latest release asset, and the app's update notifier polls the latest release tag, so publishing the release is the whole rollout.
