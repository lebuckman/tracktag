import { spawn } from 'node:child_process'

export type RunResult = { stdout: string; stderr: string; code: number | null }

/**
 * Promise wrapper around child_process.spawn with a hard timeout. Every
 * external binary goes through here so a hung child can never stall the
 * pipeline. Rejects on spawn failure or timeout; nonzero exit codes are
 * returned for the caller to interpret.
 */
export function runBinary(
  bin: string,
  args: string[],
  { timeoutMs, label }: { timeoutMs: number; label: string }
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGKILL')
      reject(new Error(`${label} timed out after ${timeoutMs / 1000}s`))
    }, timeoutMs)

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
