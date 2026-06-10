import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ArtistChipInput } from './ArtistChipInput'
import { AlbumArtUpload } from './AlbumArtUpload'
import { suggestFileName } from '@shared/filename'
import type { Metadata, Source } from '@shared/types'

type Props = {
  source: Source
  metadata: Metadata
  onChange: (metadata: Metadata) => void
}

type FieldKey = 'title' | 'artists' | 'album' | 'fileName'

const TYPE_INTERVAL_MS = 18
const FIELD_STAGGER_MS = 220

function splitArtists(value: string): string[] {
  return value
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function MetadataForm({ source, metadata, onChange }: Props): React.JSX.Element {
  const [pending, startTransition] = useTransition()
  const [fileNameDirty, setFileNameDirty] = useState(false)
  const [typing, setTyping] = useState<Set<FieldKey>>(new Set())
  const timeouts = useRef<NodeJS.Timeout[]>([])
  // Tracks the latest metadata so async typewriter ticks can merge into
  // fresh state instead of an obsolete snapshot — otherwise they overwrite
  // the auto-suggested fileName on every tick.
  const metadataRef = useRef(metadata)
  useEffect(() => {
    metadataRef.current = metadata
  })

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
      <div className="flex justify-center">
        <button type="button" onClick={autofill} disabled={pending} className="tt-btn tt-btn-aura">
          {pending ? 'Thinking…' : 'Autofill'}
        </button>
      </div>

      <div className="mt-8 flex flex-col gap-7">
        <div>
          <label className="tt-label mb-3 block" htmlFor="tt-title">
            Title
          </label>
          <input
            id="tt-title"
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
          <input
            id="tt-filename"
            className={`tt-input tt-input--mono ${inputGlowClass('fileName')}`}
            placeholder="artist_song-title.mp3"
            value={metadata.fileName}
            onChange={(e) => {
              setFileNameDirty(true)
              onChange({ ...metadata, fileName: e.target.value })
            }}
            spellCheck={false}
          />
        </div>
      </div>
    </section>
  )
}
