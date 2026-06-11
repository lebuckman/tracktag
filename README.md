# TrackTag

Download, trim, tag. A macOS desktop app that takes a YouTube URL (or a local audio/video file), optionally trims it, tags the metadata with AI, and saves a clean MP3 to a folder of your choice.

Desktop port of the original [TrackTag web app](https://github.com/lebuckman/mini-projects/tree/main/tracktag), built with Electron + electron-vite + React.

## How it works

1. Paste a YouTube link or drop a file.
2. Hit **Autofill** — Gemini reads the video title/description and fills in a properly formatted Title / Artist / Album (cover notation, version notation, event albums, the works). Edit anything it gets wrong.
3. Optionally trim with the inline scissor control.
4. Pick a folder, hit **Save MP3**.

On first launch the app asks for a Gemini API key (free at [aistudio.google.com](https://aistudio.google.com/apikey)). The key is stored locally on your Mac and only ever used from the app's main process.

## First launch on macOS

The app is unsigned (no Apple Developer subscription), so Gatekeeper will balk the first time:

> "TrackTag" can't be opened because Apple cannot check it for malicious software.

One-time fix, pick whichever matches your macOS:

- **Newer macOS:** open **System Settings → Privacy & Security**, scroll to the blocked-app message, click **Open Anyway**.
- **Older macOS:** right-click TrackTag.app → **Open** → confirm in the dialog.

That's it — one click per machine, permanent.

## Updates

- **yt-dlp keeps itself fresh.** YouTube periodically changes its player and breaks yt-dlp (the downloader TrackTag bundles). The app re-downloads the latest yt-dlp on launch (throttled to once every 6 hours), so a quit-and-reopen usually fixes sudden download failures.
- **App updates are notified, not silent.** When a newer release exists on GitHub, the app shows a toast linking to it; installing is still download-and-drag. True in-place auto-update on macOS requires a code-signed app, which this isn't (see above).
- Some videos simply won't download regardless: age-restricted, region-locked, and members-only content needs a signed-in session.

## Development

```bash
npm install        # also stages ffmpeg + downloads latest yt-dlp into resources/bin
npm run dev        # dev app with HMR
npm run typecheck
npm run lint
npm run dist       # unsigned DMG in dist/
```

Open the dev app with `#sink` in the URL hash for a kitchen-sink gallery of every UI primitive.

## A note on scope

This is a personal tool for tagging your own library — it is not, and should not become, a public download service. If you fork it, keep it personal.
