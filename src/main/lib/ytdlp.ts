import { binaryPath } from './binaries'
import { runBinary, type RunResult } from './spawn'

// yt-dlp normally completes in seconds. 60s is generous for metadata
// fetches and long enough for most downloads on a reasonable connection.
const TIMEOUT_MS = 60_000

function run(args: string[]): Promise<RunResult> {
  return runBinary(binaryPath('yt-dlp'), args, { timeoutMs: TIMEOUT_MS, label: 'yt-dlp' })
}

export type YouTubeMeta = { title: string; description: string; duration: number | null }

/**
 * One dump-json run feeds both autofill (title + description) and the trim
 * slider (duration). Extraction takes 10s+, so ipc.ts prefetches this as
 * soon as a source is set rather than when Autofill is clicked.
 */
export async function fetchYouTubeMeta(url: string): Promise<YouTubeMeta> {
  const result = await run([
    '--no-warnings',
    '--skip-download',
    '--no-playlist',
    '--dump-json',
    '--',
    url
  ])
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || 'yt-dlp failed')
  }
  const parsed = JSON.parse(result.stdout) as {
    title?: string
    description?: string
    duration?: number
  }
  const duration = Number(parsed.duration)
  return {
    title: (parsed.title ?? '').trim(),
    description: (parsed.description ?? '').trim(),
    duration: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null
  }
}

/**
 * Downloads the full audio track as MP3. Trim is always applied later by
 * ffmpeg — yt-dlp's --download-sections is approximate and unreliable.
 */
export async function downloadAudio(url: string, outputPath: string): Promise<void> {
  const result = await run([
    '--no-warnings',
    '-x',
    '--audio-format',
    'mp3',
    '--audio-quality',
    '0',
    '--ffmpeg-location',
    binaryPath('ffmpeg'),
    '-o',
    outputPath,
    '--',
    url
  ])
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || 'yt-dlp failed')
  }
}
