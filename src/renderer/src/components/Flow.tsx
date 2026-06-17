import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { SourceSelector } from './SourceSelector'
import { MetadataForm } from './MetadataForm'
import { SaveControls } from './SaveControls'
import { ScrollHint } from './ScrollHint'
import { EASE } from '../lib/motion'
import { splitArtists } from '@shared/filename'
import type { AudioOpts, HistoryEntry, Metadata, Source, TrimRange } from '@shared/types'

const EMPTY_TRIM: TrimRange = { startSec: null, endSec: null }
const EMPTY_AUDIO: AudioOpts = { fade: false, normalize: false }
const EMPTY_METADATA: Metadata = {
  title: '',
  artists: [],
  album: '',
  fileName: ''
}

type Props = {
  canAutofill: boolean
  /** A history entry to re-fill the form with (Flow is keyed so it remounts). */
  prefill?: HistoryEntry | null
}

export function Flow({ canAutofill, prefill }: Props): React.JSX.Element {
  // A file history entry has a known source but no File, so the form opens
  // with metadata filled and the user re-adds the file. YouTube sources are
  // resolved asynchronously below.
  const [source, setSource] = useState<Source | null>(() =>
    prefill?.kind === 'file'
      ? { kind: 'file', filename: prefill.sourceFilename ?? prefill.fileName, size: 0 }
      : null
  )
  const [file, setFile] = useState<File | null>(null)
  const [trim, setTrim] = useState<TrimRange>(EMPTY_TRIM)
  const [audio, setAudio] = useState<AudioOpts>(EMPTY_AUDIO)
  const [metadata, setMetadata] = useState<Metadata>(() =>
    prefill
      ? {
          title: prefill.title,
          artists: prefill.artist ? splitArtists(prefill.artist) : [],
          album: prefill.album,
          fileName: prefill.fileName
        }
      : EMPTY_METADATA
  )
  const [resetKey, setResetKey] = useState(0)
  // Whether the current form still holds the history-prefilled values. Only
  // then is the carried file name protected from the auto-suggest; cleared
  // once the user resets or picks a different source.
  const [fromPrefill, setFromPrefill] = useState(!!prefill)

  // Resolve a YouTube history entry back to a full source so it is
  // immediately re-saveable; file entries just prompt for the file. Duration
  // is filled in by the effect below. Runs once on mount — Flow is keyed per
  // selection in App.
  useEffect(() => {
    if (prefill?.kind === 'youtube' && prefill.sourceUrl) {
      const url = prefill.sourceUrl
      let cancelled = false
      window.api.fetchVideoInfo(url).then((res) => {
        if (cancelled) return
        if (!res.ok) {
          toast.error('Could not reload that link', { id: 'history-reload' })
          return
        }
        setSource(res.source)
      })
      return () => {
        cancelled = true
      }
    }
    if (prefill?.kind === 'file') {
      toast('Re-add the file to save', { id: 'history-file' })
    }
    return undefined
  }, [prefill])

  // Duration enrichment lives here (not in SourceSelector) because Flow owns
  // the source across the picker→card swap. The cancelled flag plus the
  // identity re-check in setSource stop a late callback from resurrecting a
  // source that was cleared or replaced.
  const sourceUrl = source?.kind === 'youtube' ? source.url : null
  const sourceDuration = source?.duration
  useEffect(() => {
    if (!sourceUrl || sourceDuration != null) return undefined
    let cancelled = false
    window.api.fetchVideoDuration(sourceUrl).then((duration) => {
      if (cancelled || duration == null) return
      setSource((s) => (s && s.kind === 'youtube' && s.url === sourceUrl ? { ...s, duration } : s))
    })
    return () => {
      cancelled = true
    }
  }, [sourceUrl, sourceDuration])

  const isFileSource = source?.kind === 'file'
  useEffect(() => {
    if (!isFileSource || sourceDuration != null || !file) return undefined
    let cancelled = false
    const objectUrl = URL.createObjectURL(file)
    const probe = document.createElement('audio')
    probe.preload = 'metadata'
    probe.src = objectUrl
    probe.onloadedmetadata = (): void => {
      const dur = Math.floor(probe.duration)
      URL.revokeObjectURL(objectUrl)
      if (cancelled || !Number.isFinite(dur) || dur <= 0) return
      setSource((s) => (s && s.kind === 'file' ? { ...s, duration: dur } : s))
    }
    probe.onerror = (): void => URL.revokeObjectURL(objectUrl)
    return () => {
      cancelled = true
      URL.revokeObjectURL(objectUrl)
    }
  }, [isFileSource, sourceDuration, file])

  function reset(): void {
    setSource(null)
    setFile(null)
    setTrim(EMPTY_TRIM)
    setAudio(EMPTY_AUDIO)
    setMetadata(EMPTY_METADATA)
    setFromPrefill(false)
    setResetKey((k) => k + 1)
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!source ? (
        <motion.div
          key={`pick-${resetKey}`}
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.985 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="flex min-h-screen items-center justify-center px-6"
        >
          <div className="w-full max-w-xl">
            <SourceSelector
              compact
              source={null}
              onSource={(s, f) => {
                setSource(s)
                setFile(f)
                // A manually picked source is no longer the prefilled one.
                setFromPrefill(false)
              }}
            />
          </div>
        </motion.div>
      ) : (
        <motion.div
          key={`edit-${resetKey}`}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.05 }}
          className="mx-auto flex max-w-3xl flex-col gap-14 px-8 pt-20 pb-12"
        >
          <SourceSelector
            source={source}
            onSource={(s, f) => {
              setSource(s)
              setFile(f)
              if (!s) {
                setTrim(EMPTY_TRIM)
                setAudio(EMPTY_AUDIO)
                setMetadata(EMPTY_METADATA)
                setFromPrefill(false)
              }
            }}
            trim={trim}
            onTrimChange={setTrim}
            audio={audio}
            onAudioChange={setAudio}
          />
          {/* Grouped with the same gap as the metadata fields so the
              File name → Folder spacing reads as one continuous form. */}
          <div className="flex flex-col gap-7">
            <Reveal delay={0.18}>
              <MetadataForm
                source={source}
                metadata={metadata}
                onChange={setMetadata}
                canAutofill={canAutofill}
                initialFileNameDirty={fromPrefill}
              />
            </Reveal>
            <Reveal delay={0.28}>
              <SaveControls
                source={source}
                file={file}
                trim={trim}
                audio={audio}
                metadata={metadata}
                onSaved={reset}
              />
            </Reveal>
          </div>
          <ScrollHint />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Reveal({
  children,
  delay
}: {
  children: React.ReactNode
  delay: number
}): React.JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  )
}
