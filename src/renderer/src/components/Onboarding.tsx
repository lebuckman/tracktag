import { useState, useTransition } from 'react'
import { toast } from 'sonner'

type Props = {
  /** Whether a key is already stored (settings re-entry vs first run). */
  hasKey: boolean
  onDone: () => void
}

/**
 * First-run setup: paste a Gemini key, read two one-line caveats, done.
 * Reachable again later via the corner settings button, where it doubles
 * as the "replace key" screen. The key is write-only — it goes to the
 * main process store and is never read back into the renderer.
 */
export function Onboarding({ hasKey, onDone }: Props): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const [pending, startTransition] = useTransition()

  function save(): void {
    const key = draft.trim()
    if (!key && !hasKey) return
    toast.dismiss('onboarding')
    startTransition(async () => {
      try {
        if (key) await window.api.setGeminiKey(key)
        await window.api.setOnboarded()
        onDone()
      } catch {
        toast.error('Could not save the key', { id: 'onboarding' })
      }
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="anim-rise w-full max-w-xl">
        <div className="tt-card px-8 py-10">
          <p className="tt-label">Setup</p>
          <h1
            className="mt-4 text-3xl"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              letterSpacing: '-0.025em'
            }}
          >
            {hasKey ? 'Settings' : 'Welcome to TrackTag'}
          </h1>
          <p className="mt-3 text-base" style={{ color: 'var(--color-text-muted)' }}>
            Autofill is powered by Google Gemini. Paste an API key — free at{' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-accent)' }}
            >
              aistudio.google.com
            </a>
            . It is stored on this Mac only.
          </p>

          <div className="mt-7">
            <label className="tt-label mb-3 block" htmlFor="tt-gemini-key">
              Gemini API key
            </label>
            <input
              id="tt-gemini-key"
              className="tt-input tt-input--mono"
              type="password"
              placeholder={hasKey ? 'Key saved — paste to replace' : 'AIza…'}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save()
              }}
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          <div className="mt-7 flex flex-col gap-2.5">
            <p className="text-sm" style={{ color: 'var(--color-text-dim)' }}>
              YouTube changes things now and then — if downloads suddenly fail, update the app.
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-dim)' }}>
              Age-restricted, region-locked, and member-only videos won&apos;t download.
            </p>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={save}
              disabled={pending || (!draft.trim() && !hasKey)}
              className="tt-btn tt-btn-primary"
            >
              {hasKey ? 'Done' : 'Start tagging'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
