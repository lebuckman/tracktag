import { GoogleGenAI } from '@google/genai'
import type { PrefillResult } from '../../shared/types'
import { getGeminiKey } from '../store'

const SYSTEM_PROMPT = `You are a music metadata assistant for a personal tagging app. Given source text from a YouTube video (title + description), return clean, correctly formatted metadata for the Title, Artist, and Album fields. Use your knowledge of music to enrich what is missing or ambiguous.

TITLE
- Lead with the original-language title exactly as the artist styles it (preserve casing — "CINEMA", "GLASS", lowercase, mixed-case, etc.).
- If the original is not in English, append the English translation in its own parenthesis group: "Original (English)".
- If a specific version of the song is being identified, append it in its own parenthesis group, using these descriptors:
    - Language: "(Japanese Ver.)", "(Korean Ver.)", "(English Ver.)"
    - Event / historic performance: "(1995 Wembley Ver.)", "(MTV Unplugged Ver.)"
    - Arrangement: "(Acoustic Ver.)", "(Piano Ver.)", "(Orchestral Ver.)", "(Studio Ver.)"
    - Format edit: "(Extended Ver.)", "(Radio Edit)", "(Short Ver.)"
- When BOTH translation and version apply, write the translation FIRST and the version SECOND, as two separate paren groups: "사랑 (Love) (Japanese Ver.)".
- Append a bracket tag at the END when applicable:
    - "[Original Artist Cover]" for covers. ALWAYS name the original performing artist, even if the source doesn't. Use your music knowledge for well-known songs.
    - "[Remix]" for remixes.
    - "[Demo]" for demos.
- Cover-tag artist credit:
    - Credit only the PRIMARY/lead original artist. "Best Part" → "[Daniel Caesar Cover]", not also crediting H.E.R.
    - True split-billing originals (no clear lead) → "[Artist One; Artist Two Cover]".
    - Use the artist's internationally-credited name when they have one ("4EVE", "BOWKYLION", "TWICE", "Bon Jovi", "Daniel Caesar").
    - If there is no English credit but a widely-used romanization exists, use the romanization ("Kim Kwang Seok").
    - Otherwise use the original script ("คณะขวัญใจ").
- Live performances are NOT marked in the title — the album encodes that. The "(... Ver.)" notation is for identifying which specific version is being performed/referenced, not for marking "this is live."

ARTIST
- All performers on THIS recording — never the original artist of a covered song.
- Include EVERY artist credited as a performer in the source (joint billing, duets, featured artists who actually perform, group members listed by name). Semicolon-separated with a space: "Artist One; Artist Two; Artist Three".
- Preserve credited casing: "WOODZ", "GEMINI; FOURTH", "NCT WISH" stay all-caps; "Isaac Hong", "Ben Barnes; Lizzie McAlpine" stay title-case.
- Add group context (e.g. "MINNIE of (G)I-DLE") ONLY when that exact billing is in the release credit. Don't add it just because the source mentions the member's group.

ALBUM
- Year-prefixed event/show/concert/OST/fan fest name: "2025 INDEX_00 PREVIEW CONCERT", "2023 LOVE OUT LOUD FAN FEST", "2026 WORLD TOUR Archive. 1", "2023 LAST TWILIGHT OST".
- EXCEPTION — long-running numbered TV shows/franchises where the number identifies the season skip the year prefix: "Immortal Songs 2", "Singer Again 3", "King of Mask Singer", "Begin Again", "Sing Again", etc. Recognize these ongoing series.
- OST tracks: "YYYY Show Name OST" (no parentheses around OST). Always tag even if it's the only song from the OST.
- Live recordings: "YYYY Concert Name" — no "Live" suffix, implied by the concert name.
- Preserve the event's own stylization ("INDEX_00 PREVIEW CONCERT" stays uppercase, "Archive. 1" stays mixed-case).
- If the source mentions a concert / fan meet / OST / show, tag it as the album. Only leave blank when there is truly no associated release or event.
- Never use the artist name as filler.

EXAMPLES

Source: "WOODZ 'CINEMA' | 2025 INDEX_00 PREVIEW CONCERT"
Output: {"title":"CINEMA","artist":"WOODZ","album":"2025 INDEX_00 PREVIEW CONCERT"}

Source: "JAY covers Always (1995 Wembley Version) by Bon Jovi"
Output: {"title":"Always (1995 Wembley Ver.) [Bon Jovi Cover]","artist":"JAY","album":""}

Source: "GEMINI x FOURTH - วัดปะหล่ะ? (TEST ME) — 4EVE Cover — LOVE OUT LOUD FAN FEST 2023"
Output: {"title":"วัดปะหล่ะ? (TEST ME) [4EVE Cover]","artist":"GEMINI; FOURTH","album":"2023 LOVE OUT LOUD FAN FEST"}

Source: "Isaac Hong - 거리에서 (On the Street) | Immortal Songs 2"
Output: {"title":"거리에서 (On the Street) [Kim Kwang Seok Cover]","artist":"Isaac Hong","album":"Immortal Songs 2"}

Source: "Ben Barnes x Lizzie McAlpine sing 'Best Part'"
Output: {"title":"Best Part [Daniel Caesar Cover]","artist":"Ben Barnes; Lizzie McAlpine","album":""}

Source: "WOODZ - Journey (Japanese Version)"
Output: {"title":"Journey (Japanese Ver.)","artist":"WOODZ","album":""}

OUTPUT
Respond ONLY with a valid JSON object with keys: "title", "artist", "album". No explanation, no markdown, no extra text.`

let cachedClient: GoogleGenAI | null = null
let cachedKey: string | null = null

function client(): GoogleGenAI {
  const apiKey = getGeminiKey()
  if (!apiKey) throw new Error('Gemini API key is not set — add it in TrackTag settings')
  if (cachedClient && cachedKey === apiKey) return cachedClient
  cachedClient = new GoogleGenAI({ apiKey })
  cachedKey = apiKey
  return cachedClient
}

function extractJson(text: string): string {
  // Strip a ```json fence if present, otherwise scan the raw text.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const source = fenced ? fenced[1] : text

  const start = source.indexOf('{')
  if (start === -1) return source.trim()

  // Walk braces to find the FIRST complete object. The model occasionally
  // returns multiple objects or an array (`[{…},{…}]`), in which case using
  // `lastIndexOf("}")` would yield invalid JSON like `{…},{…}`.
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < source.length; i++) {
    const ch = source[i]
    if (escape) {
      escape = false
      continue
    }
    if (ch === '\\') {
      escape = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  return source.slice(start).trim()
}

export async function prefillFromText(title: string, description: string): Promise<PrefillResult> {
  const sourceText = `SOURCE TEXT:\n${title}\n${description}`.slice(0, 10000)

  const response = await client().models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `${SYSTEM_PROMPT}\n\n${sourceText}`,
    config: {
      temperature: 0.3,
      responseMimeType: 'application/json'
    }
  })

  const text = response.text ?? ''
  const json = extractJson(text)
  let parsed: Partial<PrefillResult>
  try {
    parsed = JSON.parse(json) as Partial<PrefillResult>
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    // Avoid dumping the full model output into logs — it may include
    // long descriptions or paste from arbitrary sources. The length plus
    // a short head is enough to identify what shape went wrong.
    const preview = text.length > 200 ? `${text.slice(0, 200)}…` : text
    console.error('[gemini] failed to parse response', {
      reason,
      length: text.length,
      preview
    })
    throw new Error(`Gemini returned malformed JSON (${reason})`)
  }
  return {
    title: parsed.title ?? '',
    artist: parsed.artist ?? '',
    album: parsed.album ?? ''
  }
}
