import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { HomeButton } from './HomeButton'

type Props = {
  /** Whether a key is already stored (settings re-entry vs first run). */
  hasKey: boolean
  /** Reports whether a key exists after the screen closes. */
  onDone: (keySet: boolean) => void
  /** Settings re-entry (vs first-run): shows a Home button + inline save. */
  isSettings?: boolean
}

/**
 * First-run setup and the settings screen. The Gemini key is optional:
 * it only powers Autofill, and the flow works fully by hand without one.
 * In settings the stored key can be revealed (eye toggle) and replaced.
 */
export function Onboarding({ hasKey, onDone, isSettings = false }: Props): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const [revealed, setRevealed] = useState(false)
  // The stored key, fetched lazily the first time it is revealed. Also
  // distinguishes "typed a new key" from "looking at the saved one".
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const dirty = draft.trim().length > 0 && draft.trim() !== loadedKey

  function save(): void {
    const key = draft.trim()
    toast.dismiss('onboarding')
    startTransition(async () => {
      try {
        if (key && key !== loadedKey) await window.api.setGeminiKey(key)
        await window.api.setOnboarded()
        onDone(!!key || hasKey)
      } catch {
        toast.error('Could not save the key', { id: 'onboarding' })
      }
    })
  }

  // Settings: persist the key in place without leaving the screen. Updating
  // loadedKey clears the dirty state, which re-enables the Home button.
  function saveKey(): void {
    const key = draft.trim()
    if (!key || key === loadedKey) return
    toast.dismiss('onboarding')
    startTransition(async () => {
      try {
        await window.api.setGeminiKey(key)
        setLoadedKey(key)
        toast.success('Key saved', { id: 'onboarding' })
      } catch {
        toast.error('Could not save the key', { id: 'onboarding' })
      }
    })
  }

  // Settings: leave to the flow. Disabled while dirty, so this only fires
  // once edits are saved or cleared; the stored key is left untouched.
  function goHome(): void {
    onDone(hasKey || !!loadedKey)
  }

  function toggleReveal(): void {
    if (revealed) {
      setRevealed(false)
      // Drop back to the fixed-width dots placeholder when nothing was
      // edited, so hiding doesn't resize the field to the key's length.
      if (draft === loadedKey) setDraft('')
      return
    }
    if (loadedKey !== null) {
      if (!draft) setDraft(loadedKey)
      setRevealed(true)
      return
    }
    window.api.getGeminiKey().then((key) => {
      setLoadedKey(key)
      if (!draft) setDraft(key)
      setRevealed(true)
    })
  }

  const buttonLabel = hasKey
    ? dirty
      ? 'Save'
      : 'Back'
    : draft.trim()
      ? 'Start tagging'
      : 'Skip for now'

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
          <p
            className="mt-3 text-base"
            style={{ color: 'var(--color-text-muted)', textWrap: 'pretty' }}
          >
            The Autofill button reads a video&apos;s title and description with Google Gemini and
            formats clean tags using rules tailored for music (cover and version notation, event
            album naming). It needs an API key, free at{' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-accent)' }}
            >
              aistudio.google.com
            </a>
            , stored on this Mac and only used to request tags. Without one, everything still works:
            you just fill the fields in yourself.
          </p>

          <div className="mt-7">
            <label className="tt-label mb-3 block" htmlFor="tt-gemini-key">
              Gemini API key · optional
            </label>
            <div className="flex items-stretch gap-3">
              <div className="relative flex-1">
                <input
                  id="tt-gemini-key"
                  className="tt-input tt-input--mono"
                  type={revealed ? 'text' : 'password'}
                  placeholder={hasKey ? '••••••••••••' : 'AIza…'}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onFocus={(e) => {
                    // Highlight the whole key so it's quick to replace.
                    if (e.target.value) e.target.select()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (isSettings) saveKey()
                      else save()
                    }
                  }}
                  spellCheck={false}
                  autoComplete="off"
                  style={hasKey ? { paddingRight: '3rem' } : undefined}
                />
                {hasKey && (
                  <button
                    type="button"
                    onClick={toggleReveal}
                    aria-label={revealed ? 'Hide key' : 'Show key'}
                    aria-pressed={revealed}
                    className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md transition-colors"
                    style={{ color: revealed ? 'var(--color-text)' : 'var(--color-text-dim)' }}
                  >
                    <EyeIcon open={revealed} />
                  </button>
                )}
              </div>
              {isSettings && (
                <button
                  type="button"
                  onClick={saveKey}
                  disabled={!dirty || pending}
                  className="tt-btn tt-btn-primary shrink-0"
                >
                  Save
                </button>
              )}
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-2.5">
            <p className="text-sm" style={{ color: 'var(--color-text-dim)', textWrap: 'pretty' }}>
              Downloads run through yt-dlp, which YouTube breaks every few weeks by changing its
              player code. TrackTag fetches the latest yt-dlp on launch, so if downloads start
              failing, quitting and reopening the app usually picks up the fix.
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-dim)', textWrap: 'pretty' }}>
              Videos that require a signed-in session (age-restricted, region-locked, or
              members-only) cannot be downloaded.
            </p>
          </div>

          {!isSettings && (
            <div className="mt-8 flex justify-end">
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="tt-btn tt-btn-primary"
              >
                {buttonLabel}
              </button>
            </div>
          )}
        </div>
      </div>
      {isSettings && <HomeButton onClick={goHome} disabled={dirty} position="settings" />}
    </div>
  )
}

function EyeIcon({ open }: { open: boolean }): React.JSX.Element {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <line x1="4" y1="20" x2="20" y2="4" />}
    </svg>
  )
}
