import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { app } from 'electron'

/**
 * yt-dlp and ffmpeg ship as extraResources at <resources>/bin. In dev they
 * live at <repo>/resources/bin, populated by `npm run fetch-binaries`
 * (ffmpeg is copied out of the ffmpeg-static package; yt-dlp is downloaded
 * from its GitHub releases).
 */
function binDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'bin')
    : join(app.getAppPath(), 'resources', 'bin')
}

export function bundledBinaryPath(name: 'yt-dlp' | 'ffmpeg'): string {
  const path = join(binDir(), name)
  if (!existsSync(path)) {
    throw new Error(
      app.isPackaged
        ? `Bundled ${name} is missing — reinstall the app`
        : `${name} not found at ${path} — run \`npm run fetch-binaries\``
    )
  }
  return path
}

export function binaryPath(name: 'yt-dlp' | 'ffmpeg'): string {
  // yt-dlp self-updates into userData/bin (see lib/updater.ts); a fresher
  // copy there wins over the one that shipped with the app.
  if (name === 'yt-dlp') {
    const updated = join(app.getPath('userData'), 'bin', 'yt-dlp')
    if (existsSync(updated)) return updated
  }
  return bundledBinaryPath(name)
}
