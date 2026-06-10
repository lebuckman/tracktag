import { useRef, useState } from 'react'
import type { Metadata } from '@shared/types'

type Props = {
  art: Metadata['albumArt'] | undefined
  onChange: (art: Metadata['albumArt'] | undefined) => void
}

export function AlbumArtUpload({ art, onChange }: Props): React.JSX.Element {
  const [dragOver, setDragOver] = useState(false)
  const [hover, setHover] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function readFile(file: File): void {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (): void => {
      if (typeof reader.result === 'string') {
        onChange({ dataUrl: reader.result, mime: file.type })
      }
    }
    reader.readAsDataURL(file)
  }

  if (art) {
    return (
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
          <button type="button" onClick={() => inputRef.current?.click()} className="tt-action">
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
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) readFile(f)
            // Reset so picking the same file again still fires onChange.
            e.target.value = ''
          }}
        />
      </div>
    )
  }

  return (
    <label
      htmlFor="tt-art"
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
      className="flex h-27.5 cursor-pointer items-center justify-center rounded-md border border-dashed text-center transition-colors"
      style={{
        borderColor: dragOver
          ? 'var(--color-accent-glow)'
          : hover
            ? 'var(--color-border-strong)'
            : 'var(--color-border)',
        background: dragOver
          ? 'var(--color-accent-soft)'
          : hover
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
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) readFile(f)
          // Reset so picking the same file again still fires onChange.
          e.target.value = ''
        }}
      />
    </label>
  )
}
