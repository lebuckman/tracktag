import { app, BrowserWindow } from 'electron'
import { spawn } from 'node:child_process'
import { promises as fs, existsSync } from 'node:fs'
import path from 'node:path'
import { bundledBinaryPath } from './binaries'
import { getLastYtdlpCheck, setLastYtdlpCheck } from '../store'

// yt-dlp is the part of the app that actually breaks (YouTube player
// changes), so it keeps itself fresh independently of app releases: the
// latest release is downloaded into userData/bin and preferred over the
// bundled copy. No code signing concerns — it's data, not app code.

const YTDLP_RELEASE_API = 'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest'
const YTDLP_DOWNLOAD_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos'
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

const APP_RELEASE_API = 'https://api.github.com/repos/lebuckman/tracktag/releases/latest'

export function updatedYtdlpDir(): string {
  return path.join(app.getPath('userData'), 'bin')
}

export function updatedYtdlpPath(): string {
  return path.join(updatedYtdlpDir(), 'yt-dlp')
}

function currentYtdlpVersion(): Promise<string> {
  return new Promise((resolve) => {
    const bin = existsSync(updatedYtdlpPath()) ? updatedYtdlpPath() : bundledBinaryPath('yt-dlp')
    const child = spawn(bin, ['--version'], { stdio: ['ignore', 'pipe', 'ignore'] })
    let out = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolve('')
    }, 10_000)
    child.stdout.on('data', (c) => (out += c.toString()))
    child.on('error', () => {
      clearTimeout(timer)
      resolve('')
    })
    child.on('close', () => {
      clearTimeout(timer)
      resolve(out.trim())
    })
  })
}

/**
 * Best-effort, fully silent: failures leave the existing binary in place.
 * Throttled so GitHub's unauthenticated rate limit is never a concern.
 */
export async function selfUpdateYtdlp(): Promise<void> {
  try {
    const last = getLastYtdlpCheck()
    if (Date.now() - last < CHECK_INTERVAL_MS) return
    setLastYtdlpCheck(Date.now())

    const res = await fetch(YTDLP_RELEASE_API, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return
    const release = (await res.json()) as { tag_name?: string }
    const latest = (release.tag_name ?? '').trim()
    if (!latest) return

    const current = await currentYtdlpVersion()
    if (current === latest) return

    const download = await fetch(YTDLP_DOWNLOAD_URL, {
      redirect: 'follow',
      signal: AbortSignal.timeout(120_000)
    })
    if (!download.ok) return
    const buffer = Buffer.from(await download.arrayBuffer())
    // yt-dlp_macos is a ~35 MB PyInstaller bundle; anything tiny is an
    // error page and must not clobber a working binary.
    if (buffer.length < 1_000_000) return

    await fs.mkdir(updatedYtdlpDir(), { recursive: true })
    const tmp = updatedYtdlpPath() + '.tmp'
    await fs.writeFile(tmp, buffer, { mode: 0o755 })
    await fs.rename(tmp, updatedYtdlpPath())
    console.log(`[updater] yt-dlp updated to ${latest}`)
  } catch (err) {
    console.error('[updater] yt-dlp self-update skipped', err)
  }
}

function isNewer(latest: string, current: string): boolean {
  const a = latest.split('.').map(Number)
  const b = current.split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (Number.isNaN(x) || Number.isNaN(y)) return false
    if (x !== y) return x > y
  }
  return false
}

/**
 * App updates stay manual (unsigned builds can't use Squirrel.Mac), but
 * detection is automatic: a newer GitHub release raises a persistent
 * toast in the renderer linking to the download.
 */
export async function notifyIfAppUpdateAvailable(win: BrowserWindow): Promise<void> {
  try {
    const res = await fetch(APP_RELEASE_API, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return
    const release = (await res.json()) as { tag_name?: string; html_url?: string }
    const latest = (release.tag_name ?? '').replace(/^v/, '').trim()
    if (!latest || !release.html_url) return
    if (isNewer(latest, app.getVersion()) && !win.isDestroyed()) {
      win.webContents.send('update-available', { version: latest, url: release.html_url })
    }
  } catch {
    // Offline or repo has no releases yet — nothing to do.
  }
}
