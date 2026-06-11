import { binaryPath } from './binaries'
import { runBinary } from './spawn'

// libmp3lame runs far faster than realtime; even very long sources finish
// in well under five minutes, so anything past that is a hung child.
const TIMEOUT_MS = 5 * 60_000

export async function convertToMp3(
  inputPath: string,
  outputPath: string,
  trim?: { start?: number; end?: number }
): Promise<void> {
  const args: string[] = ['-y']

  if (trim?.start != null) {
    args.push('-ss', String(trim.start))
  }
  if (trim?.end != null) {
    args.push('-to', String(trim.end))
  }

  args.push('-i', inputPath, '-vn', '-acodec', 'libmp3lame', '-q:a', '0', outputPath)

  const result = await runBinary(binaryPath('ffmpeg'), args, {
    timeoutMs: TIMEOUT_MS,
    label: 'ffmpeg'
  })
  if (result.code !== 0) {
    throw new Error(result.stderr.trim().split('\n').pop() || 'ffmpeg failed')
  }
}
