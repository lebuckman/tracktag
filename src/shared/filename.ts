const MAX_TITLE_WORDS = 6

// Words inside a trailing paren group that mark it as a "version notation"
// rather than an English translation — see the Gemini system prompt rules.
// Versions are KEPT in the filename body; translations REPLACE the base title.
const VERSION_HINTS_RE =
  /\b(Ver\.?|Remix|Edit|Acoustic|Piano|Orchestral|Studio|Extended|Short|Radio|Live|Demo|Instrumental|Acapella)\b/i

function stripBracketTag(title: string): string {
  return title.replace(/\s*\[[^\]]+\]\s*$/, '').trim()
}

/**
 * Decide what to feed the filename slugifier from a structured title like
 * `Original (Translation) (Version) [Cover Tag]`.
 *
 *  - "Ghost"                                       → "Ghost"
 *  - "사랑 (Love)"                                 → "Love"
 *  - "Journey (Japanese Ver.)"                     → "Journey Japanese Ver."
 *  - "사랑 (Love) (Japanese Ver.)"                 → "Love Japanese Ver."
 *  - "Always (1995 Wembley Ver.) [Bon Jovi Cover]" → "Always 1995 Wembley Ver."
 */
function pickBody(title: string): string {
  let base = stripBracketTag(title)
  const versions: string[] = []

  // Peel trailing paren groups one at a time. Versions get collected and
  // re-appended; the first non-version paren is treated as the English
  // translation and replaces the base.
  while (true) {
    const m = base.match(/\s*\(([^)]+)\)\s*$/)
    if (!m) break
    const content = m[1].trim()
    if (VERSION_HINTS_RE.test(content)) {
      versions.unshift(content)
      base = base.slice(0, m.index).trim()
    } else {
      base = content
      break
    }
  }

  return [base, ...versions].join(' ')
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9_\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function trimWords(value: string, max: number): string {
  const words = value.split('-').filter(Boolean)
  if (words.length <= max) return words.join('-')
  return words.slice(0, max).join('-')
}

function isCover(title: string): boolean {
  return /\[[^\]]*cover[^\]]*\]/i.test(title)
}

export function suggestFileName(title: string, artists: string[]): string {
  const artistSlug = artists
    .map((a) => slugify(a))
    .filter(Boolean)
    .join('-')

  if (!title) return artistSlug ? `${artistSlug}.mp3` : ''

  const body0 = pickBody(title)
  let body = trimWords(slugify(body0), MAX_TITLE_WORDS)
  if (!body) body = 'track'
  if (isCover(title) && !body.endsWith('cover')) body = `${body}-cover`

  return artistSlug ? `${artistSlug}_${body}.mp3` : `${body}.mp3`
}

export function sanitizeFileName(value: string): string {
  const base = value.replace(/\.mp3$/i, '')
  const cleaned = slugify(base)
  return cleaned ? `${cleaned}.mp3` : ''
}
