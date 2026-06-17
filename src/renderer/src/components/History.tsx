import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmModal } from './ConfirmModal'
import type { HistoryEntry } from '@shared/types'

type Props = {
  /** Re-fill the form from a past save. */
  onSelect: (entry: HistoryEntry) => void
}

function formatWhen(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

/**
 * Timeline of past saves, newest first. In normal mode a row re-fills the
 * form (YouTube fully; file rows metadata-only) and the thumbnail opens the
 * video link. Select mode turns rows into a multi-select for deletion. Cover
 * art is never stored, so rows show the YouTube thumbnail or a glyph.
 */
export function History({ onSelect }: Props): React.JSX.Element {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    window.api.getHistory().then(setEntries)
  }, [])

  function exitSelect(): void {
    setSelectMode(false)
    setSelected(new Set())
  }

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const total = entries?.length ?? 0
  const allSelected = total > 0 && selected.size === total

  function toggleAll(): void {
    setSelected(allSelected ? new Set() : new Set(entries?.map((e) => e.id)))
  }

  async function deleteSelected(): Promise<void> {
    const ids = [...selected]
    try {
      if (entries && ids.length === entries.length) {
        await window.api.clearHistory()
        setEntries([])
      } else {
        await Promise.all(ids.map((id) => window.api.deleteHistoryEntry(id)))
        setEntries((prev) => (prev ? prev.filter((e) => !selected.has(e.id)) : prev))
      }
    } catch {
      toast.error('Could not remove those entries', { id: 'history-delete' })
    } finally {
      // Always close the prompt and leave select mode so the UI can't stick.
      setConfirming(false)
      exitSelect()
    }
  }

  return (
    <div className="min-h-screen px-6 pt-20 pb-16">
      <div className="anim-rise mx-auto w-full max-w-2xl">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h1
            className="text-3xl"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              letterSpacing: '-0.025em'
            }}
          >
            History
          </h1>
          {total > 0 &&
            (selectMode ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exitSelect}
                  className="tt-btn tt-btn-ghost"
                  style={{ padding: '0.45rem 0.85rem' }}
                >
                  Cancel
                </button>
                {selected.size === 0 ? (
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="tt-btn"
                    style={{ padding: '0.45rem 0.85rem' }}
                  >
                    Select all
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    className="tt-btn tt-btn-primary"
                    style={{ padding: '0.45rem 0.85rem' }}
                  >
                    Delete ({selected.size})
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSelectMode(true)}
                className="tt-btn tt-btn-ghost"
                style={{ padding: '0.45rem 0.85rem' }}
              >
                Select
              </button>
            ))}
        </div>

        {entries === null ? null : entries.length === 0 ? (
          <div className="mt-24 flex flex-col items-center gap-3 text-center">
            <p
              className="text-lg"
              style={{
                color: 'var(--color-text)',
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
                letterSpacing: '-0.015em'
              }}
            >
              No saves yet
            </p>
            <p className="max-w-xs text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Tracks you save will show up here. Tap one to load it back into the form.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {entries.map((entry) => (
              <HistoryRow
                key={entry.id}
                entry={entry}
                selectMode={selectMode}
                selected={selected.has(entry.id)}
                onActivate={() => (selectMode ? toggle(entry.id) : onSelect(entry))}
              />
            ))}
          </div>
        )}
      </div>

      {confirming && (
        <ConfirmModal
          title={`Remove ${selected.size} ${selected.size === 1 ? 'entry' : 'entries'}?`}
          body="The selected entries leave history. Your downloaded files are not affected."
          confirmLabel="Remove"
          onConfirm={deleteSelected}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  )
}

function HistoryRow({
  entry,
  selectMode,
  selected,
  onActivate
}: {
  entry: HistoryEntry
  selectMode: boolean
  selected: boolean
  onActivate: () => void
}): React.JSX.Element {
  const subtitle = [entry.artist, entry.album].filter(Boolean).join(' | ')
  const canOpenLink = !selectMode && entry.kind === 'youtube' && !!entry.sourceUrl

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(e) => {
        // Only the row itself — let a nested control (the link button) handle
        // its own keys instead of also re-filling the form.
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onActivate()
        }
      }}
      className="tt-card flex cursor-pointer items-center gap-5 px-5 py-5 transition-all hover:-translate-y-0.5 hover:border-(--color-border-strong)"
      style={
        selected
          ? { borderColor: 'var(--color-accent)', background: 'var(--color-elev-3)' }
          : undefined
      }
    >
      <div
        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md"
        style={{ background: 'var(--color-elev-1)', border: '1px solid var(--color-border)' }}
      >
        {entry.kind === 'youtube' && entry.thumbnail ? (
          <img
            src={entry.thumbnail}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span
              className="text-[0.6rem] uppercase tracking-[0.18em]"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}
            >
              {entry.kind === 'file' ? 'File' : 'YT'}
            </span>
          </div>
        )}

        {/* Open the video link without triggering the row. */}
        {canOpenLink && (
          <button
            type="button"
            aria-label="Open video link"
            onClick={(e) => {
              e.stopPropagation()
              // Guard the scheme before handing off to the OS opener.
              if (entry.sourceUrl?.startsWith('https://')) window.open(entry.sourceUrl, '_blank')
            }}
            className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity hover:opacity-100"
            style={{ background: 'rgba(6,6,9,0.55)', color: 'var(--color-text)' }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 11l6-6" />
              <path d="M6.5 4.5H11V9" />
            </svg>
          </button>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className="truncate text-lg leading-snug"
          style={{
            color: 'var(--color-text)',
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            letterSpacing: '-0.015em'
          }}
        >
          {entry.title || entry.fileName}
        </p>
        {subtitle && (
          <p className="mt-1 truncate text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {subtitle}
          </p>
        )}
        <p
          className="mt-1.5 truncate text-xs"
          style={{ color: 'var(--color-text-dim)', fontFamily: 'var(--font-mono)' }}
        >
          {entry.fileName}
        </p>
      </div>

      <p className="tt-meta shrink-0 self-start">{formatWhen(entry.savedAt)}</p>
    </div>
  )
}
