import { useState, type KeyboardEvent } from 'react'

type Props = {
  artists: string[]
  onChange: (artists: string[]) => void
  glow?: 'active' | 'soft' | 'none'
}

export function ArtistChipInput({ artists, onChange, glow = 'none' }: Props): React.JSX.Element {
  const [draft, setDraft] = useState('')

  function commit(value: string): void {
    const cleaned = value.trim()
    if (!cleaned) return
    if (artists.includes(cleaned)) {
      setDraft('')
      return
    }
    onChange([...artists, cleaned])
    setDraft('')
  }

  function remove(index: number): void {
    onChange(artists.filter((_, i) => i !== index))
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit(draft)
    } else if (e.key === 'Backspace' && !draft && artists.length) {
      onChange(artists.slice(0, -1))
    }
  }

  return (
    <div
      className={`tt-chip-input ${
        glow === 'active' ? 'tt-glow' : glow === 'soft' ? 'tt-glow-soft' : ''
      }`}
    >
      {artists.map((artist, i) => (
        <span key={`${artist}-${i}`} className="tt-chip-input__chip">
          {artist}
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label={`Remove ${artist}`}
            className="tt-chip-input__remove"
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => commit(draft)}
        placeholder={artists.length ? 'Add another…' : 'Artist(s)…'}
        spellCheck={false}
        autoComplete="off"
      />
    </div>
  )
}
