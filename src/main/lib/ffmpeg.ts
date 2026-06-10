import { spawn } from 'node:child_process'
import { binaryPath } from './binaries'

function run(args: string[]): Promise<{ stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath('ffmpeg'), args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk) => (stderr += chunk.toString()))
    child.on('error', reject)
    child.on('close', (code) => resolve({ stderr, code }))
  })
}

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

  const result = await run(args)
  if (result.code !== 0) {
    throw new Error(result.stderr.trim().split('\n').pop() || 'ffmpeg failed')
  }
}
