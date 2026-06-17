import { useEffect, useRef, useState, useTransition } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { ProcessingIndicator } from './ProcessingIndicator'
import { EASE } from '../lib/motion'
import type { AudioOpts, Metadata, SavePayload, Source, TrimRange } from '@shared/types'

type Props = {
  source: Source
  file: File | null
  trim: TrimRange
  audio: AudioOpts
  metadata: Metadata
  onSaved: () => void
}

type SavedInfo = { fileName: string; path: string }
type Resolution = 'overwrite' | 'keepBoth'

export function SaveControls({
  source,
  file,
  trim,
  audio,
  metadata,
  onSaved
}: Props): React.JSX.Element {
  const [folder, setFolder] = useState('')
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState<SavedInfo | null>(null)
  // Set when the destination already holds a file with this name; the
  // prompt lets the user overwrite or keep both, then re-saves.
  const [conflict, setConflict] = useState<{ fileName: string } | null>(null)
  // The form signature at the moment of the last save. Any later change to a
  // field re-arms Save MP3 (the success card folds away), so the user can
  // just scroll up, edit, and re-save — no explicit "edit" button needed.
  const savedSigRef = useRef<string | null>(null)

  // Everything a save depends on, so a change to any of it counts as an edit.
  const saveSig = JSON.stringify({
    start: trim.startSec,
    end: trim.endSec,
    fade: audio.fade,
    normalize: audio.normalize,
    folder,
    title: metadata.title,
    artists: metadata.artists,
    album: metadata.album,
    fileName: metadata.fileName,
    // Fingerprint the cover by length+mime rather than stringifying the whole
    // base64 data URL on every keystroke.
    art: metadata.albumArt ? `${metadata.albumArt.mime}:${metadata.albumArt.dataUrl.length}` : '',
    file: file ? `${file.name}:${file.size}:${file.lastModified}` : ''
  })

  useEffect(() => {
    window.api.readLastFolder().then((value) => {
      if (value) setFolder(value)
    })
  }, [])

  // The status card appears below the fold; scroll to the very bottom of the
  // page once it has expanded (height animates ~0.38s), and again when it
  // swaps to the success / conflict card.
  useEffect(() => {
    if (!pending && !saved && !conflict) return
    const t = setTimeout(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
    }, 440)
    return () => clearTimeout(t)
  }, [pending, saved, conflict])

  // Re-arm after a save when any field changes.
  useEffect(() => {
    if (saved && savedSigRef.current !== null && savedSigRef.current !== saveSig) {
      savedSigRef.current = null
      setSaved(null)
    }
  }, [saveSig, saved])

  // Cmd/Ctrl+Enter saves from anywhere in the form. The ref keeps the handler
  // current without re-binding the window listener each render; the guard
  // skips it while a modal (crop / confirm) is open.
  const trySaveRef = useRef<() => void>(() => {})
  useEffect(() => {
    trySaveRef.current = () => {
      if (!canSave || busy) return
      if (document.querySelector('[role="dialog"]')) return
      runSave()
    }
  })
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        trySaveRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // The web version was a free-text path input (filesystem-API limits).
  // Here the same tt-input chrome opens the native directory picker.
  function chooseFolder(): void {
    window.api.pickFolder().then((result) => {
      // Cancel comes back as { ok: false } — a no-op, not an error.
      if (result.ok) {
        setFolder(result.folder)
        void window.api.setLastFolder(result.folder)
      }
    })
  }

  // Tags are optional — only a file name and destination are required.
  const canSave =
    !!metadata.fileName.trim() && !!folder.trim() && (source.kind === 'youtube' || file !== null)

  function runSave(onConflict?: Resolution): void {
    if (!canSave || pending) return
    toast.dismiss('save')

    const common = {
      title: metadata.title,
      artist: metadata.artists.join('; '),
      album: metadata.album,
      fileName: metadata.fileName,
      folder,
      trimStartSec: trim.startSec ?? undefined,
      trimEndSec: trim.endSec ?? undefined,
      albumArtDataUrl: metadata.albumArt?.dataUrl,
      fade: audio.fade,
      normalize: audio.normalize,
      onConflict
    }

    let payload: SavePayload
    if (source.kind === 'youtube') {
      payload = { kind: 'youtube', url: source.url, ...common }
    } else {
      if (!file) return
      const filePath = window.api.getPathForFile(file)
      if (!filePath) {
        toast.error('Save failed: could not resolve the file path', { id: 'save' })
        return
      }
      payload = { kind: 'file', filePath, ...common }
    }

    startTransition(async () => {
      const result = await window.api.saveFile(payload)
      if (!result.ok) {
        if ('conflict' in result) {
          setConflict({ fileName: result.fileName })
          return
        }
        toast.error(`Save failed: ${result.error}`, { id: 'save' })
        return
      }
      setConflict(null)
      savedSigRef.current = saveSig
      setSaved({
        fileName: result.savedPath.split('/').pop() ?? metadata.fileName,
        path: result.savedPath
      })
    })
  }

  function handleSave(): void {
    if (saved) return
    runSave()
  }

  function resolveConflict(resolution: Resolution): void {
    setConflict(null)
    runSave(resolution)
  }

  function reset(): void {
    savedSigRef.current = null
    setSaved(null)
    onSaved()
  }

  async function revealSaved(): Promise<void> {
    if (!saved) return
    const result = await window.api.revealItem(saved.path)
    if (!result.ok) {
      toast.error('That file has moved or been deleted', { id: 'reveal' })
    }
  }

  const busy = pending || !!saved || !!conflict
  const showCard = pending || !!saved || !!conflict

  return (
    <section className="anim-rise">
      <label className="tt-label mb-3 block" htmlFor="tt-folder">
        Folder
      </label>
      <div className="flex items-stretch gap-3">
        <button
          id="tt-folder"
          type="button"
          onClick={chooseFolder}
          disabled={busy}
          className="tt-input flex-1 text-left"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.9rem',
            color: folder ? 'var(--color-text)' : 'var(--color-text-dim)'
          }}
        >
          {folder || 'Choose folder…'}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || busy}
          className="tt-btn tt-btn-primary shrink-0"
        >
          Save MP3
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showCard && (
          <motion.div
            key="status"
            initial={{ opacity: 0, y: 14, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{
              height: { duration: 0.38, ease: EASE },
              opacity: { duration: 0.28, ease: 'linear' },
              y: { duration: 0.38, ease: EASE }
            }}
            style={{ overflow: 'hidden' }}
          >
            <div className="mt-6">
              <div className="tt-card px-8 py-10">
                <AnimatePresence mode="wait" initial={false}>
                  {pending ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.26, ease: EASE }}
                      className="flex flex-col items-center gap-5 text-center"
                    >
                      <ProcessingIndicator
                        label={
                          source.kind === 'youtube'
                            ? 'Downloading and tagging…'
                            : 'Converting and tagging…'
                        }
                      />
                    </motion.div>
                  ) : conflict ? (
                    <ConflictPrompt
                      key="conflict"
                      fileName={conflict.fileName}
                      onResolve={resolveConflict}
                      onCancel={() => setConflict(null)}
                    />
                  ) : saved ? (
                    <SuccessState saved={saved} onReset={reset} onReveal={revealSaved} />
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

function SuccessState({
  saved,
  onReset,
  onReveal
}: {
  saved: SavedInfo
  onReset: () => void
  onReveal: () => void
}): React.JSX.Element {
  return (
    <motion.div
      key="success"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.36, ease: EASE }}
      className="flex flex-col items-center gap-7 text-center"
    >
      <Checkmark />
      <div className="flex flex-col items-center gap-2">
        <p className="tt-label">Saved</p>
        <p
          className="mt-2 text-xl leading-snug"
          style={{
            color: 'var(--color-text)',
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            letterSpacing: '-0.01em'
          }}
        >
          {saved.fileName}
        </p>
        {/* The path reveals the file in Finder; reports if it has since moved. */}
        <button
          type="button"
          onClick={onReveal}
          title="Reveal in Finder"
          className="tt-reveal-path mt-1 inline-flex max-w-md items-center gap-1.5 break-all text-xs"
          style={{ color: 'var(--color-text-dim)', fontFamily: 'var(--font-mono)' }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
            aria-hidden
          >
            <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h3l1.5 1.5h4.5A1.5 1.5 0 0 1 14 6v5.5A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5z" />
          </svg>
          <span className="text-left">{saved.path}</span>
        </button>
      </div>
      <button type="button" onClick={onReset} className="tt-btn">
        Tag another
      </button>
    </motion.div>
  )
}

function ConflictPrompt({
  fileName,
  onResolve,
  onCancel
}: {
  fileName: string
  onResolve: (resolution: Resolution) => void
  onCancel: () => void
}): React.JSX.Element {
  return (
    <motion.div
      key="conflict"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.32, ease: EASE }}
      className="flex flex-col items-center gap-6 text-center"
    >
      <div className="flex flex-col items-center gap-2">
        <p className="tt-label">File already exists</p>
        <p
          className="mt-2 max-w-md break-all text-base leading-snug"
          style={{ color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}
        >
          {fileName}
        </p>
        <p className="mt-1 max-w-sm text-sm" style={{ color: 'var(--color-text-dim)' }}>
          Overwrite the existing file, or keep both with a numbered name?
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={onCancel} className="tt-btn tt-btn-ghost">
          Cancel
        </button>
        <button type="button" onClick={() => onResolve('overwrite')} className="tt-btn">
          Overwrite
        </button>
        <button
          type="button"
          onClick={() => onResolve('keepBoth')}
          className="tt-btn tt-btn-primary"
        >
          Keep both
        </button>
      </div>
    </motion.div>
  )
}

function Checkmark(): React.JSX.Element {
  return (
    <div
      className="relative flex h-16 w-16 items-center justify-center rounded-full"
      style={{
        background: 'var(--color-accent-soft)',
        border: '1px solid var(--color-accent-glow)',
        boxShadow: '0 0 32px rgba(212, 180, 140, 0.35)'
      }}
    >
      <svg
        width="34"
        height="34"
        viewBox="0 0 34 34"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <motion.path
          d="M9 17.5l5 5 11-12"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{
            pathLength: { duration: 0.55, ease: 'easeOut', delay: 0.05 },
            opacity: { duration: 0.18, delay: 0.05 }
          }}
        />
      </svg>
    </div>
  )
}
