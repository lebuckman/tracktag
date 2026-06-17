import { useEffect, useRef, useState } from 'react'
import { formatTimecode, isValidTimecode, parseTimecode } from '../lib/time'
import type { TrimRange } from '@shared/types'

type Props = {
  duration: number | null
  trim: TrimRange
  onChange: (trim: TrimRange) => void
}

/**
 * Minimal trim control: [start timecode] — [dual-handle range] — [end timecode].
 * The two timecode inputs ARE the labels — they show the current start/end and
 * also accept typed edits. No additional labels.
 */
export function SimpleTrim({ duration, trim, onChange }: Props): React.JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<'start' | 'end' | null>(null)

  // Refs let the pointer listeners read the latest trim/onChange without
  // re-attaching on every drag tick.
  const trimRef = useRef(trim)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    trimRef.current = trim
    onChangeRef.current = onChange
  })

  const dur = duration ?? 0
  const startSec = trim.startSec ?? 0
  const endSec = trim.endSec ?? dur
  const startPct = dur > 0 ? (startSec / dur) * 100 : 0
  const endPct = dur > 0 ? (endSec / dur) * 100 : 100

  useEffect(() => {
    function onMove(e: PointerEvent): void {
      if (!dragging.current || !trackRef.current || !duration) return
      const rect = trackRef.current.getBoundingClientRect()
      const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1)
      const secs = Math.round(ratio * duration)
      const t = trimRef.current
      if (dragging.current === 'start') {
        const maxStart = (t.endSec ?? duration) - 1
        const next = Math.min(Math.max(0, secs), Math.max(0, maxStart))
        onChangeRef.current({ ...t, startSec: next === 0 ? null : next })
      } else {
        const minEnd = (t.startSec ?? 0) + 1
        const next = Math.max(Math.min(duration, secs), minEnd)
        onChangeRef.current({ ...t, endSec: next === duration ? null : next })
      }
    }
    function onUp(): void {
      dragging.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [duration])

  const disabled = !duration

  return (
    <div className="flex items-center gap-4">
      <TimeField
        value={trim.startSec}
        placeholder="0:00"
        onCommit={(v) => onChange({ ...trim, startSec: v })}
      />

      <div
        ref={trackRef}
        className="relative flex h-7 flex-1 select-none items-center"
        style={{ opacity: disabled ? 0.45 : 1 }}
      >
        {/* base track */}
        <div className="h-0.75 w-full rounded-full" style={{ background: 'var(--color-border)' }} />
        {/* selected segment */}
        <div
          className="absolute top-1/2 h-0.75 -translate-y-1/2 rounded-full"
          style={{
            left: `${startPct}%`,
            right: `${100 - endPct}%`,
            background: 'var(--color-accent)',
            boxShadow: '0 0 12px rgba(212, 180, 140, 0.5)'
          }}
        />
        {!disabled && (
          <>
            <Handle position={startPct} onPointerDown={() => (dragging.current = 'start')} />
            <Handle position={endPct} onPointerDown={() => (dragging.current = 'end')} />
          </>
        )}
      </div>

      <TimeField
        value={trim.endSec}
        placeholder={duration ? formatTimecode(duration) : '—:—'}
        onCommit={(v) => onChange({ ...trim, endSec: v })}
      />
    </div>
  )
}

function Handle({
  position,
  onPointerDown
}: {
  position: number
  onPointerDown: () => void
}): React.JSX.Element {
  return (
    <div
      // Decorative drag affordance — the timecode inputs are the keyboard- and
      // screen-reader-accessible control, so the handle stays out of the tab
      // order and the a11y tree.
      aria-hidden
      onPointerDown={(e) => {
        e.preventDefault()
        onPointerDown()
      }}
      className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2"
      style={{
        left: `${position}%`,
        background: 'var(--color-bg)',
        borderColor: 'var(--color-accent)',
        boxShadow: '0 0 0 1px rgba(212,180,140,0.25), 0 0 14px rgba(212,180,140,0.55)'
      }}
    />
  )
}

function TimeField({
  value,
  placeholder,
  onCommit
}: {
  value: number | null
  placeholder: string
  onCommit: (secs: number | null) => void
}): React.JSX.Element {
  const [draft, setDraft] = useState(value != null ? formatTimecode(value) : '')
  const [synced, setSynced] = useState(value)

  if (value !== synced) {
    setSynced(value)
    setDraft(value != null ? formatTimecode(value) : '')
  }

  const valid = isValidTimecode(draft)

  return (
    <input
      className="tt-input tt-input--mono shrink-0 text-center"
      style={{
        width: '92px',
        padding: '0.55rem',
        fontSize: '0.9rem'
      }}
      placeholder={placeholder}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (!draft.trim()) {
          onCommit(null)
          return
        }
        const parsed = parseTimecode(draft)
        if (parsed != null) onCommit(parsed)
        else setDraft(value != null ? formatTimecode(value) : '')
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      spellCheck={false}
      autoComplete="off"
      aria-invalid={!valid}
    />
  )
}
