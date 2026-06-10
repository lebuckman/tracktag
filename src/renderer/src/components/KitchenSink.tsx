import { useState } from 'react'
import { toast } from 'sonner'

/**
 * Dev-only gallery of every tt-* primitive and glow state. Open with the
 * `#sink` hash. Exists so visual regressions in the token layer are easy
 * to catch by eye — it is not part of the user flow.
 */
export function KitchenSink(): React.JSX.Element {
  const [tab, setTab] = useState<'youtube' | 'file'>('youtube')

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-12 px-8 pt-20 pb-40">
      <section>
        <p className="tt-label mb-4 block">Type</p>
        <p className="tt-display text-4xl">Display — Bricolage Grotesque</p>
        <p className="mt-2">Body — Instrument Sans, quiet and readable.</p>
        <p className="tt-meta mt-2">META LINE · JETBRAINS MONO</p>
      </section>

      <section>
        <p className="tt-label mb-4 block">Inputs</p>
        <div className="flex flex-col gap-4">
          <input className="tt-input" placeholder="Resting tt-input…" />
          <input className="tt-input tt-input--mono" placeholder="mono_variant.mp3" />
          <input className="tt-input tt-glow" defaultValue="Active glow (being typed)" readOnly />
          <input className="tt-input tt-glow-soft" defaultValue="Soft glow (affected)" readOnly />
          <input className="tt-input tt-glow-loading" defaultValue="Loading glow" readOnly />
          <input className="tt-input tt-glow-error" defaultValue="Error glow" readOnly />
          <div className="tt-chip-input">
            <span className="tt-chip-input__chip">
              WOODZ
              <button type="button" className="tt-chip-input__remove">
                ×
              </button>
            </span>
            <input placeholder="Add another…" />
          </div>
        </div>
      </section>

      <section>
        <p className="tt-label mb-4 block">Buttons</p>
        <div className="flex flex-wrap items-center gap-4">
          <button className="tt-btn">Default</button>
          <button className="tt-btn tt-btn-primary">Save MP3</button>
          <button className="tt-btn tt-btn-primary" disabled>
            Disabled primary
          </button>
          <button className="tt-btn tt-btn-ghost">Ghost</button>
          <button className="tt-btn tt-btn-danger-ghost">Remove</button>
          <button className="tt-btn tt-btn-aura">Autofill</button>
          <button className="tt-btn tt-btn-aura" disabled>
            Thinking…
          </button>
          <button className="tt-action">Replace</button>
        </div>
      </section>

      <section>
        <p className="tt-label mb-4 block">Tabs</p>
        <div
          role="tablist"
          className="inline-flex items-center gap-1 rounded-xl border p-1"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-elev-1)' }}
        >
          {(['youtube', 'file'] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={tab === m}
              onClick={() => setTab(m)}
              className="tt-tab"
            >
              {m === 'youtube' ? 'YouTube' : 'File'}
            </button>
          ))}
        </div>
      </section>

      <section>
        <p className="tt-label mb-4 block">Card + waveform</p>
        <div className="tt-card flex items-center gap-4 p-8">
          <div className="flex h-6.5 items-center gap-0.75">
            {Array.from({ length: 14 }).map((_, i) => (
              <span
                key={i}
                className="waveform-bar"
                style={{ animationDelay: `${i * 70}ms`, opacity: 0.45 + (i % 3) * 0.18 }}
              />
            ))}
          </div>
          <p className="tt-meta">Downloading and tagging…</p>
        </div>
      </section>

      <section>
        <p className="tt-label mb-4 block">Toasts</p>
        <button
          className="tt-btn"
          onClick={() => toast.error('Persistent error toast', { id: 'sink' })}
        >
          Fire error toast
        </button>
      </section>
    </div>
  )
}
