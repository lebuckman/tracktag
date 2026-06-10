const RE = /^(?:(\d+):)?([0-5]?\d):([0-5]\d)$|^([0-5]?\d):([0-5]\d)$/

export function isValidTimecode(value: string): boolean {
  if (!value.trim()) return true
  return RE.test(value.trim())
}

export function parseTimecode(value: string): number | null {
  const v = value.trim()
  if (!v) return null
  if (!RE.test(v)) return null
  const parts = v.split(':').map((p) => Number(p))
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return null
}

export function formatTimecode(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number): string => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}
