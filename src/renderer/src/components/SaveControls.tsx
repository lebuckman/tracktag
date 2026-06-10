import { useEffect, useState, useTransition } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { ProcessingIndicator } from './ProcessingIndicator'
import type { Metadata, SavePayload, Source, TrimRange } from '@shared/types'

type Props = {
  source: Source
  file: File | null
  trim: TrimRange
  metadata: Metadata
  onSaved: () => void
}

type SavedInfo = { fileName: string; path: string }

const EASE = [0.2, 0.7, 0.2, 1] as const

export function SaveControls({ source, file, trim, metadata, onSaved }: Props): React.JSX.Element {
  const [folder, setFolder] = useState('')
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState<SavedInfo | null>(null)

  useEffect(() => {
    window.api.readLastFolder().then((value) => {
      if (value) setFolder(value)
    })
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

  const canSave =
    !!metadata.title.trim() &&
    metadata.artists.length > 0 &&
    !!metadata.fileName.trim() &&
    !!folder.trim() &&
    (source.kind === 'youtube' || file !== null)

  function handleSave(): void {
    if (!canSave || pending || saved) return
    toast.dismiss('save')

    const common = {
      title: metadata.title,
      artist: metadata.artists.join('; '),
      album: metadata.album,
      fileName: metadata.fileName,
      folder,
      trimStartSec: trim.startSec ?? undefined,
      trimEndSec: trim.endSec ?? undefined,
      albumArtDataUrl: metadata.albumArt?.dataUrl
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
        toast.error(`Save failed: ${result.error}`, { id: 'save' })
        return
      }
      setSaved({
        fileName: result.savedPath.split('/').pop() ?? metadata.fileName,
        path: result.savedPath
      })
    })
  }

  function reset(): void {
    setSaved(null)
    onSaved()
  }

  const showCard = pending || !!saved

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
          disabled={pending || !!saved}
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
          disabled={!canSave || pending || !!saved}
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
                  ) : saved ? (
                    <SuccessState saved={saved} onReset={reset} />
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
  onReset
}: {
  saved: SavedInfo
  onReset: () => void
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
        <p
          className="mt-1 max-w-md break-all text-xs"
          style={{
            color: 'var(--color-text-dim)',
            fontFamily: 'var(--font-mono)'
          }}
        >
          {saved.path}
        </p>
      </div>
      <button type="button" onClick={onReset} className="tt-btn">
        Tag another
      </button>
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
