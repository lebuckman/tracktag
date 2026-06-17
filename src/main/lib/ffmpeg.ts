import { binaryPath } from './binaries'
import { runBinary } from './spawn'

// libmp3lame runs far faster than realtime; even very long sources finish
// in well under five minutes, so anything past that is a hung child.
const TIMEOUT_MS = 5 * 60_000

// A hard trim slices the waveform at a non-zero sample, which the ear hears
// as a click. A near-inaudible fade smooths both ends away. The opt-in
// musical fade is much longer and obvious by design.
const ANTICLICK_SEC = 0.015
const FADE_IN_SEC = 0.8
const FADE_OUT_SEC = 1.2

// EBU R128 integrated-loudness target. -18 LUFS is deliberately conservative
// — quieter than Spotify/YouTube (-14) which over-boosts most rips.
const LOUDNORM_BASE = 'loudnorm=I=-18:TP=-1.5:LRA=11'

export type ConvertOpts = {
  trim?: { start?: number; end?: number }
  fade?: boolean
  normalize?: boolean
}

type LoudnormStats = {
  input_i: string
  input_tp: string
  input_lra: string
  input_thresh: string
  target_offset: string
}

/** In/out fades: micro anti-click on trims, longer musical fade when opted in. */
function fadeFilters(opts: ConvertOpts): string[] {
  // The micro anti-click fade only applies where a trim actually cuts the
  // waveform; an untrimmed source with the toggle off gets no fade at all.
  const hasTrim = opts.trim?.start != null || opts.trim?.end != null
  if (!opts.fade && !hasTrim) return []
  const fadeIn = opts.fade ? FADE_IN_SEC : ANTICLICK_SEC
  const fadeOut = opts.fade ? FADE_OUT_SEC : ANTICLICK_SEC
  // Fade the true end by reversing, fading in, and reversing back — lands
  // exactly on the last sample without needing a (possibly rounded) duration.
  return [`afade=t=in:st=0:d=${fadeIn}`, 'areverse', `afade=t=in:st=0:d=${fadeOut}`, 'areverse']
}

function trimArgs(opts: ConvertOpts): string[] {
  const args: string[] = []
  if (opts.trim?.start != null) args.push('-ss', String(opts.trim.start))
  if (opts.trim?.end != null) args.push('-to', String(opts.trim.end))
  return args
}

/**
 * First pass of two-pass loudnorm: measure the (trimmed) audio and parse the
 * JSON loudnorm prints to stderr. Returns null if anything is off so the
 * caller can fall back to single-pass.
 */
async function measureLoudness(
  inputPath: string,
  opts: ConvertOpts
): Promise<LoudnormStats | null> {
  const args = [
    '-y',
    ...trimArgs(opts),
    '-i',
    inputPath,
    '-vn',
    '-af',
    `${LOUDNORM_BASE}:print_format=json`,
    '-f',
    'null',
    '-'
  ]
  const result = await runBinary(binaryPath('ffmpeg'), args, {
    timeoutMs: TIMEOUT_MS,
    label: 'ffmpeg loudnorm measure'
  })
  if (result.code !== 0) return null
  // The JSON object is the trailing {...} block in stderr.
  const match = result.stderr.match(/\{[^}]*"target_offset"[^}]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0]) as LoudnormStats
  } catch {
    return null
  }
}

/** The loudnorm filter for the apply pass, using measured values + linear gain. */
function loudnormApply(stats: LoudnormStats): string {
  return (
    `${LOUDNORM_BASE}:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}` +
    `:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}` +
    `:offset=${stats.target_offset}:linear=true`
  )
}

export async function convertToMp3(
  inputPath: string,
  outputPath: string,
  opts: ConvertOpts = {}
): Promise<void> {
  // Two-pass loudnorm: measure first so the apply pass lands precisely on the
  // target with flat (linear) gain — no pumping, no single-pass overshoot. A
  // failed/unparseable measure falls back to single-pass.
  let loudnorm: string | null = null
  if (opts.normalize) {
    const stats = await measureLoudness(inputPath, opts)
    loudnorm = stats ? loudnormApply(stats) : LOUDNORM_BASE
  }

  const filters = [...(loudnorm ? [loudnorm] : []), ...fadeFilters(opts)]

  const args = ['-y', ...trimArgs(opts), '-i', inputPath, '-vn']
  if (filters.length > 0) args.push('-af', filters.join(','))
  args.push('-acodec', 'libmp3lame', '-q:a', '0', outputPath)

  const result = await runBinary(binaryPath('ffmpeg'), args, {
    timeoutMs: TIMEOUT_MS,
    label: 'ffmpeg'
  })
  if (result.code !== 0) {
    throw new Error(result.stderr.trim().split('\n').pop() || 'ffmpeg failed')
  }
}
