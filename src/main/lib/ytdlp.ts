import { binaryPath } from './binaries'
import { runBinary, type RunResult } from './spawn'

// yt-dlp normally completes in seconds. 60s is generous for metadata
// fetches and long enough for most downloads on a reasonable connection.
const TIMEOUT_MS = 60_000

function run(args: string[]): Promise<RunResult> {
  return runBinary(binaryPath('yt-dlp'), args, { timeoutMs: TIMEOUT_MS, label: 'yt-dlp' })
}

export async function fetchYouTubeMeta(
  url: string
): Promise<{ title: string; description: string }> {
  const result = await run(['--no-warnings', '--skip-download', '--dump-json', '--', url])
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || 'yt-dlp failed')
  }
  const parsed = JSON.parse(result.stdout) as {
    title?: string
    description?: string
  }
  return {
    title: (parsed.title ?? '').trim(),
    description: (parsed.description ?? '').trim()
  }
}

export async function fetchDuration(url: string): Promise<number | null> {
  try {
    const result = await run([
      '--no-warnings',
      '--skip-download',
      '--print',
      '%(duration)s',
      '--',
      url
    ])
    if (result.code !== 0) return null
    const n = Number(result.stdout.trim())
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null
  } catch {
    return null
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
