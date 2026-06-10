const PATTERNS = [
  /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
  /^([A-Za-z0-9_-]{11})$/
]

export function parseVideoId(input: string): string | null {
  const trimmed = input.trim()
  for (const pattern of PATTERNS) {
    const match = trimmed.match(pattern)
    if (match) return match[1]
  }
  return null
}

export function thumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
}

export function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}
