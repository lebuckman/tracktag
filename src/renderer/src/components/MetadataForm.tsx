import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ArtistChipInput } from './ArtistChipInput'
import { AlbumArtUpload } from './AlbumArtUpload'
import { splitArtists, suggestFileName } from '@shared/filename'
import type { Metadata, Source } from '@shared/types'

type Props = {
  source: Source
  metadata: Metadata
  onChange: (metadata: Metadata) => void
  /** Autofill needs a Gemini key; without one the button is hidden. */
  canAutofill: boolean
  /**
   * Start with the file name treated as user-edited, so the auto-suggest
   * doesn't overwrite a name carried in from history.
   */
  initialFileNameDirty?: boolean
}

type FieldKey = 'title' | 'artists' | 'album' | 'fileName'

const TYPE_INTERVAL_MS = 18
const FIELD_STAGGER_MS = 220

export function MetadataForm({
  source,
  metadata,
  onChange,
  canAutofill,
  initialFileNameDirty = false
}: Props): React.JSX.Element {
  const [pending, startTransition] = useTransition()
  const [fileNameDirty, setFileNameDirty] = useState(initialFileNameDirty)
  const [typing, setTyping] = useState<Set<FieldKey>>(new Set())
  const timeouts = useRef<NodeJS.Timeout[]>([])
  // Tracks the latest metadata so async typewriter ticks can merge into
  // fresh state instead of an obsolete snapshot — otherwise they overwrite
  // the auto-suggested fileName on every tick.
  const metadataRef = useRef(metadata)
  useEffect(() => {
    metadataRef.current = metadata
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  // When the edit step first appears, focus Title so the user can type (or
  // tab onward) right away. preventScroll keeps the source card in view.
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    return () => {
      timeouts.current.forEach(clearTimeout)
    }
  }, [])

  useEffect(() => {
    if (fileNameDirty) return
    if (typing.has('fileName')) return
    const suggestion = suggestFileName(metadata.title, metadata.artists)
    if (suggestion && suggestion !== metadata.fileName) {
      onChange({ ...metadata, fileName: suggestion })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metadata.title, metadata.artists, fileNameDirty])

  const affected = pending || typing.size > 0
  const glowFor = (field: FieldKey): 'active' | 'soft' | 'none' => {
    if (typing.has(field)) return 'active'
    if (affected) return 'soft'
    return 'none'
  }

  function inputGlowClass(field: FieldKey): string {
    const state = glowFor(field)
    if (state === 'active') return 'tt-glow'
    if (state === 'soft') return 'tt-glow-soft'
    return ''
  }

  function typewrite(field: 'title' | 'album', value: string, startAt: number): void {
    setTyping((s) => new Set(s).add(field))
    for (let i = 0; i <= value.length; i++) {
      const t = setTimeout(
        () => {
          // Always merge into the LATEST metadata so concurrent updates
          // (e.g. the fileName auto-suggest effect) survive the tick.
          onChange({ ...metadataRef.current, [field]: value.slice(0, i) })
          if (i === value.length) {
            setTyping((s) => {
              const next = new Set(s)
              next.delete(field)
              return next
            })
          }
        },
        startAt + i * TYPE_INTERVAL_MS
      )
      timeouts.current.push(t)
    }
  }

  function autofill(): void {
    toast.dismiss('autofill')
    // Cancel any in-flight typewriter. Without resetting `typing`, any
    // fields that were mid-animation stay marked as typing and their
    // input keeps glowing — visible if the next attempt errors out
    // before reaching the new typewrite() call.
    timeouts.current.forEach(clearTimeout)
    timeouts.current = []
    setTyping(new Set())

    startTransition(async () => {
      const result =
        source.kind === 'youtube'
          ? await window.api.prefillMetadata({
              kind: 'youtube',
              url: source.url,
              fallbackTitle: source.title
            })
          : await window.api.prefillMetadata({
              kind: 'file',
              filename: source.filename
            })

      if (!result.ok) {
        toast.error(`Autofill failed: ${result.error}`, { id: 'autofill' })
        return
      }

      // Reset only the fields autofill manages — let the fileName auto-
      // suggest take over again.
      onChange({
        ...metadataRef.current,
        title: '',
        artists: [],
        album: '',
        fileName: ''
      })
      setFileNameDirty(false)

      const data = result.data
      let cursor = 0

      typewrite('title', data.title, cursor)
      const titleDuration = data.title.length * TYPE_INTERVAL_MS
      cursor += titleDuration + FIELD_STAGGER_MS

      const artistList = splitArtists(data.artist)
      setTyping((s) => new Set(s).add('artists'))
      const tArtists = setTimeout(() => {
        onChange({ ...metadataRef.current, artists: artistList })
        setTyping((s) => {
          const next = new Set(s)
          next.delete('artists')
          return next
        })
      }, cursor)
      timeouts.current.push(tArtists)
      cursor += FIELD_STAGGER_MS

      typewrite('album', data.album, cursor)
    })
  }

  return (
    <section className="anim-rise">
      {canAutofill && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={autofill}
            disabled={pending}
            className="tt-btn tt-btn-aura"
          >
            {pending ? 'Thinking…' : 'Autofill'}
          </button>
        </div>
      )}

      <div className={`flex flex-col gap-7 ${canAutofill ? 'mt-8' : ''}`}>
        <div>
          <label className="tt-label mb-3 block" htmlFor="tt-title">
            Title
          </label>
          <input
            id="tt-title"
            ref={titleRef}
            className={`tt-input ${inputGlowClass('title')}`}
            placeholder="Song title…"
            value={metadata.title}
            onChange={(e) => onChange({ ...metadata, title: e.target.value })}
            spellCheck={false}
          />
        </div>

        <div>
          <label className="tt-label mb-3 block">Artist</label>
          <ArtistChipInput
            artists={metadata.artists}
            onChange={(artists) => onChange({ ...metadata, artists })}
            glow={glowFor('artists')}
          />
        </div>

        <div>
          <label className="tt-label mb-3 block" htmlFor="tt-album">
            Album
          </label>
          <input
            id="tt-album"
            className={`tt-input ${inputGlowClass('album')}`}
            placeholder="Concert / Show Name"
            value={metadata.album}
            onChange={(e) => onChange({ ...metadata, album: e.target.value })}
            spellCheck={false}
          />
        </div>

        <div>
          <label className="tt-label mb-3 block">Album art</label>
          <AlbumArtUpload
            art={metadata.albumArt}
            onChange={(albumArt) => onChange({ ...metadata, albumArt })}
          />
        </div>

        <div>
          <label className="tt-label mb-3 block" htmlFor="tt-filename">
            File name
          </label>
          {/* The `.mp3` extension is a fixed suffix — the user only edits the
              stem, so it can never be deleted. field-sizing keeps the input
              hugging the stem so the suffix sits right after it. */}
          <div
            onMouseDown={(e) => {
              // Clicking anywhere in the field (the suffix or the empty space
              // past the stem) focuses the input with the caret at the end,
              // just before .mp3 — like a normal single text field.
              if (e.target !== fileInputRef.current) {
                e.preventDefault()
                const el = fileInputRef.current
                if (el) {
                  el.focus()
                  el.setSelectionRange(el.value.length, el.value.length)
                }
              }
            }}
            className={`tt-input tt-input--mono ${inputGlowClass('fileName')} flex items-center focus-within:border-(--color-border-strong) focus-within:bg-(--color-elev-2)`}
          >
            <input
              id="tt-filename"
              ref={fileInputRef}
              className="min-w-0 max-w-full bg-transparent outline-none"
              style={
                {
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  letterSpacing: 'inherit',
                  color: 'inherit',
                  fieldSizing: 'content'
                } as React.CSSProperties
              }
              placeholder="artist_song-title"
              value={metadata.fileName.replace(/\.mp3$/i, '')}
              onChange={(e) => {
                setFileNameDirty(true)
                const stem = e.target.value.replace(/\.mp3$/i, '')
                onChange({ ...metadata, fileName: stem ? `${stem}.mp3` : '' })
              }}
              spellCheck={false}
            />
            <span className="shrink-0 select-none" style={{ color: 'var(--color-text-dim)' }}>
              .mp3
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
