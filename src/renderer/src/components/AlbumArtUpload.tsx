import { useEffect, useRef, useState } from 'react'
import { CropModal } from './CropModal'
import type { Metadata } from '@shared/types'

type Props = {
  art: Metadata['albumArt'] | undefined
  onChange: (art: Metadata['albumArt'] | undefined) => void
}

export function AlbumArtUpload({ art, onChange }: Props): React.JSX.Element {
  const [dragOver, setDragOver] = useState(false)
  const [hover, setHover] = useState(false)
  const [focused, setFocused] = useState(false)
  // The picked image waiting to be cropped/confirmed in the modal.
  const [pending, setPending] = useState<{ dataUrl: string; mime: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const replaceRef = useRef<HTMLButtonElement>(null)
  // After a crop confirms, land focus on Replace rather than letting the
  // modal's focus-restore drop it on <body> (which sends Tab to the top).
  const focusAfterCrop = useRef(false)

  useEffect(() => {
    if (art && focusAfterCrop.current) {
      focusAfterCrop.current = false
      replaceRef.current?.focus()
    }
  }, [art])

  // Read the picked file and hand it to the crop modal — nothing is
  // committed until the user confirms a crop (or keeps the original).
  function readFile(file: File): void {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (): void => {
      if (typeof reader.result === 'string') {
        setPending({ dataUrl: reader.result, mime: file.type })
      }
    }
    reader.readAsDataURL(file)
  }

  const cropModal = pending && (
    <CropModal
      src={pending.dataUrl}
      mime={pending.mime}
      onCancel={() => setPending(null)}
      onConfirm={(dataUrl, mime) => {
        onChange({ dataUrl, mime })
        focusAfterCrop.current = true
        setPending(null)
      }}
    />
  )

  if (art) {
    return (
      <>
        {cropModal}
        <div className="flex items-center gap-5">
          <div
            className="relative h-27.5 w-27.5 shrink-0 overflow-hidden rounded-md"
            style={{
              background: 'var(--color-elev-1)',
              border: '1px solid var(--color-border)'
            }}
          >
            <img
              src={art.dataUrl}
              alt="Album art preview"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
          <div className="flex flex-col items-start gap-1">
            <button
              ref={replaceRef}
              type="button"
              onClick={() => inputRef.current?.click()}
              className="tt-action"
            >
              Replace
            </button>
            <button type="button" onClick={() => onChange(undefined)} className="tt-action">
              Remove
            </button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            tabIndex={-1}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) readFile(f)
              // Reset so picking the same file again still fires onChange.
              e.target.value = ''
            }}
          />
        </div>
      </>
    )
  }

  return (
    <>
      {cropModal}
      {/* A focusable button (not a bare label) so it sits in the tab order
          with a visible highlight; the file input is taken out of the tab
          order so it isn't an invisible stop. */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Add album art"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const dropped = e.dataTransfer.files?.[0]
          if (dropped) readFile(dropped)
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="flex h-27.5 cursor-pointer items-center justify-center rounded-md border border-dashed text-center outline-none transition-colors"
        style={{
          // Keyboard focus mirrors the hover treatment; the accent is
          // reserved for an active drag-over.
          borderColor: dragOver
            ? 'var(--color-accent-glow)'
            : hover || focused
              ? 'var(--color-border-strong)'
              : 'var(--color-border)',
          background: dragOver
            ? 'var(--color-accent-soft)'
            : hover || focused
              ? 'var(--color-elev-2)'
              : 'var(--color-elev-1)'
        }}
      >
        <p
          className="text-[0.7rem] uppercase tracking-[0.12em]"
          style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-text-dim)'
          }}
        >
          Drop or click to add art
        </p>
        <input
          id="tt-art"
          ref={inputRef}
          type="file"
          accept="image/*"
          tabIndex={-1}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) readFile(f)
            // Reset so picking the same file again still fires onChange.
            e.target.value = ''
          }}
        />
      </div>
    </>
  )
}
