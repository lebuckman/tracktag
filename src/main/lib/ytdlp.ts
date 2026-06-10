import { spawn } from 'node:child_process'
import { binaryPath } from './binaries'

type SpawnResult = { stdout: string; stderr: string; code: number | null }

// yt-dlp normally completes in seconds. A stalled network or hung child
// would otherwise hang the save pipeline indefinitely. 60s is generous
// for fetchYouTubeMeta and long enough for most downloadAudio runs on a
// reasonable connection.
const TIMEOUT_MS = 60_000

function run(args: string[]): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath('yt-dlp'), args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGKILL')
      reject(new Error(`yt-dlp timed out after ${TIMEOUT_MS / 1000}s`))
    }, TIMEOUT_MS)

    child.stdout.on('data', (chunk) => (stdout += chunk.toString()))
    child.stderr.on('data', (chunk) => (stderr += chunk.toString()))
    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ stdout, stderr, code })
    })
  })
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
