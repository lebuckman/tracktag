import { useRef, useState, useTransition } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { SimpleTrim } from './SimpleTrim'
import type { FileSource, Source, TrimRange } from '@shared/types'

type Mode = 'youtube' | 'file'

const ACCEPT = '.mp3,.mp4,.mov,.m4a,.wav,.flac'
const ACCEPT_MIMES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/x-flac',
  'video/mp4',
  'video/quicktime'
]

function looksAccepted(file: File): boolean {
  if (ACCEPT_MIMES.includes(file.type)) return true
  const name = file.name.toLowerCase()
  return ACCEPT.split(',').some((ext) => name.endsWith(ext))
}

type Props = {
  source: Source | null
  onSource: (source: Source | null, file: File | null) => void
  /** Center-screen single-input mode (no "Source" header). */
  compact?: boolean
  /** Trim state — rendered inline inside the source card when expanded. */
  trim?: TrimRange
  onTrimChange?: (trim: TrimRange) => void
}

export function SourceSelector({
  source,
  onSource,
  compact = false,
  trim,
  onTrimChange
}: Props): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('youtube')
  const [url, setUrl] = useState('')
  const [urlInvalid, setUrlInvalid] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [dropHover, setDropHover] = useState(false)
  const [trimOpen, setTrimOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Incremented every time a new source is initiated or the source is
  // cleared. Async probes (duration fetch, audio metadata) capture this
  // value and bail if it no longer matches — otherwise a late callback
  // can resurrect a stale or cleared source.
  const probeTokenRef = useRef(0)

  const hasTrim = !!trim && (trim.startSec != null || trim.endSec != null)

  function submitUrl(next: string): void {
    if (!next.trim()) return
    setUrlInvalid(false)
    const token = ++probeTokenRef.current
    startTransition(async () => {
      const result = await window.api.fetchVideoInfo(next)
      if (token !== probeTokenRef.current) return
      if (!result.ok) {
        toast.error(result.error, { id: 'source-url' })
        setUrlInvalid(true)
        onSource(null, null)
        return
      }
      toast.dismiss('source-url')
      setUrlInvalid(false)
      const initialSource = result.source
      onSource(initialSource, null)

      // Lazy-fetch duration for the trim slider.
      window.api.fetchVideoDuration(initialSource.url).then((duration) => {
        if (token !== probeTokenRef.current) return
        if (duration != null) {
          onSource({ ...initialSource, duration }, null)
        }
      })
    })
  }

  function acceptFile(picked: File): void {
    if (!looksAccepted(picked)) {
      toast.error('Unsupported file type', { id: 'source-file' })
      return
    }
    toast.dismiss('source-file')
    const token = ++probeTokenRef.current
    const fileSource: FileSource = {
      kind: 'file',
      filename: picked.name,
      size: picked.size
    }
    onSource(fileSource, picked)

    // Read duration via a hidden media element.
    const objectUrl = URL.createObjectURL(picked)
    const probe = document.createElement('audio')
    probe.preload = 'metadata'
    probe.src = objectUrl
    probe.onloadedmetadata = (): void => {
      const dur = Math.floor(probe.duration)
      URL.revokeObjectURL(objectUrl)
      if (token !== probeTokenRef.current) return
      if (Number.isFinite(dur) && dur > 0) {
        onSource({ ...fileSource, duration: dur }, picked)
      }
    }
    probe.onerror = (): void => URL.revokeObjectURL(objectUrl)
  }

  function clear(): void {
    toast.dismiss('source-url')
    toast.dismiss('source-file')
    // Invalidate any in-flight probes so they don't resurrect the source.
    probeTokenRef.current++
    setUrl('')
    setUrlInvalid(false)
    onSource(null, null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (source) {
    return (
      <section className="anim-rise">
        <div className="mb-5 flex items-center justify-between">
          <p className="tt-label">Source</p>
          <button
            onClick={clear}
            className="tt-btn tt-btn-ghost"
            style={{ padding: '0.45rem 0.85rem' }}
            aria-label="Clear source"
          >
            Clear
          </button>
        </div>
        <div className="tt-card overflow-hidden">
          {source.kind === 'youtube' ? (
            <div className="relative aspect-video w-full bg-black">
              <img
                src={source.thumbnail}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background: 'linear-gradient(to top, rgba(8,8,11,0.85) 0%, rgba(8,8,11,0) 45%)'
                }}
              />
            </div>
          ) : (
            <div
              className="flex aspect-video w-full items-center justify-center"
              style={{ background: 'var(--color-elev-1)' }}
            >
              <FileGlyph ext={source.filename.split('.').pop() ?? 'file'} />
            </div>
          )}

          <div className="p-6">
            {source.kind === 'youtube' ? (
              <div>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-baseline gap-2.5 transition-colors"
                  style={{ color: 'var(--color-text)' }}
                >
                  <span
                    className="text-xl leading-snug transition-colors group-hover:text-(--color-accent)"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 500,
                      letterSpacing: '-0.015em'
                    }}
                  >
                    {source.title}
                  </span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 translate-y-px text-(--color-text-muted) transition-all group-hover:-translate-y-px group-hover:translate-x-px group-hover:text-(--color-accent)"
                    aria-hidden
                  >
                    <path d="M5 11l6-6" />
                    <path d="M6.5 4.5h4.5V9" />
                  </svg>
                </a>
              </div>
            ) : (
              <p
                className="text-xl leading-snug"
                style={{
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  letterSpacing: '-0.015em'
                }}
              >
                {source.filename}
              </p>
            )}
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="tt-meta">
                {source.kind === 'youtube'
                  ? source.channel
                    ? `YouTube · ${source.channel}`
                    : `YouTube · ${source.videoId}`
                  : `Local · ${(source.size / (1024 * 1024)).toFixed(1)} MB`}
              </p>
              {trim && onTrimChange && (
                <button
                  type="button"
                  onClick={() => setTrimOpen((o) => !o)}
                  aria-expanded={trimOpen}
                  aria-label={trimOpen ? 'Hide trim' : 'Show trim'}
                  className="group relative inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors"
                  style={{
                    borderColor: trimOpen ? 'var(--color-border-strong)' : 'var(--color-border)',
                    background: trimOpen ? 'var(--color-elev-3)' : 'var(--color-elev-2)',
                    color: 'var(--color-text-muted)'
                  }}
                >
                  <ScissorsIcon />
                  {hasTrim && (
                    <span
                      aria-hidden
                      className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
                      style={{
                        background: 'var(--color-accent)',
                        boxShadow: '0 0 6px var(--color-accent-glow)'
                      }}
                    />
                  )}
                </button>
              )}
            </div>

            <AnimatePresence initial={false}>
              {trimOpen && trim && onTrimChange && (
                <motion.div
                  key="trim"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{
                    height: { duration: 0.34, ease: [0.2, 0.7, 0.2, 1] },
                    opacity: { duration: 0.22, ease: 'linear' }
                  }}
                  style={{ overflow: 'hidden' }}
                >
                  <div
                    className="mt-5 border-t pt-5"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <SimpleTrim
                      duration={source.duration ?? null}
                      trim={trim}
                      onChange={onTrimChange}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>
    )
  }

  const toggle = (
    <div
      role="tablist"
      aria-label="Source type"
      className="inline-flex items-center gap-1 rounded-xl border p-1"
      style={{
        borderColor: 'var(--color-border)',
        background: 'var(--color-elev-1)'
      }}
    >
      {(['youtube', 'file'] as const).map((m) => (
        <button
          key={m}
          role="tab"
          aria-selected={mode === m}
          onClick={() => {
            setMode(m)
            clear()
          }}
          className="tt-tab"
        >
          {m === 'youtube' ? 'YouTube' : 'File'}
        </button>
      ))}
    </div>
  )

  return (
    <section className={compact ? '' : 'anim-rise'}>
      {compact ? (
        <div className="mb-6 flex justify-center">{toggle}</div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="tt-label">Source</p>
          {toggle}
        </div>
      )}

      <motion.div
        layout
        transition={{ duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }}
        // popLayout positions the exiting tab pane with position:absolute
        // against the nearest positioned ancestor — without relative here
        // the ghost lands far from the swap and flashes across the screen.
        className={`relative ${compact ? '' : 'mt-6'}`}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {mode === 'youtube' ? (
            <motion.div
              key="youtube"
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
            >
              <input
                className={`tt-input ${
                  pending ? 'tt-glow-loading' : urlInvalid ? 'tt-glow-error' : ''
                }`}
                placeholder="https://www.youtube.com/watch?v=…"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  toast.dismiss('source-url')
                  setUrlInvalid(false)
                }}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text')
                  if (pasted) {
                    setUrl(pasted)
                    submitUrl(pasted)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitUrl(url)
                }}
                onBlur={() => {
                  if (url && !source) submitUrl(url)
                }}
                spellCheck={false}
                autoComplete="off"
              />
            </motion.div>
          ) : (
            <motion.div
              key="file"
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
            >
              <label
                htmlFor="tt-file"
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onMouseEnter={() => setDropHover(true)}
                onMouseLeave={() => setDropHover(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  const dropped = e.dataTransfer.files?.[0]
                  if (dropped) acceptFile(dropped)
                }}
                className="flex cursor-pointer items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center transition-colors"
                style={{
                  borderColor: dragOver
                    ? 'var(--color-accent-glow)'
                    : dropHover
                      ? 'var(--color-border-strong)'
                      : 'var(--color-border)',
                  background: dragOver
                    ? 'var(--color-accent-soft)'
                    : dropHover
                      ? 'var(--color-elev-2)'
                      : 'var(--color-elev-1)'
                }}
              >
                <div>
                  <p className="text-base" style={{ color: 'var(--color-text-muted)' }}>
                    Drop a file
                  </p>
                  <p className="tt-meta mt-3">mp3 · mp4 · mov · m4a · wav · flac</p>
                </div>
              </label>
              <input
                ref={fileInputRef}
                id="tt-file"
                type="file"
                accept={ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  const picked = e.target.files?.[0]
                  if (picked) acceptFile(picked)
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </section>
  )
}

function ScissorsIcon(): React.JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="transition-colors group-hover:text-(--color-text)"
      aria-hidden
    >
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  )
}

function FileGlyph({ ext }: { ext: string }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-2xl border"
        style={{ borderColor: 'var(--color-border-strong)' }}
      >
        <span
          className="text-base uppercase tracking-[0.2em]"
          style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-text-muted)'
          }}
        >
          {ext.slice(0, 4)}
        </span>
      </div>
      <p className="tt-meta">Local file</p>
    </div>
  )
}
