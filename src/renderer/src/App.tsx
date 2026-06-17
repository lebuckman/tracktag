import { lazy, Suspense, useEffect, useState } from 'react'
import { toast, Toaster } from 'sonner'
import { GradientDots } from './components/GradientDots'
import { PixelCursorTrail } from './components/PixelCursorTrail'
import { GithubLink } from './components/GithubLink'
import { SettingsButton } from './components/SettingsButton'
import { HistoryButton } from './components/HistoryButton'
import { HomeButton } from './components/HomeButton'
import { History } from './components/History'
import { Onboarding } from './components/Onboarding'
import { Flow } from './components/Flow'
import { installDevApiStub } from './lib/devApiStub'
import type { HistoryEntry } from '@shared/types'

installDevApiStub()

// Dev-only gallery; the DEV gate folds away in production builds so the
// chunk is never emitted or reachable.
const KitchenSink = import.meta.env.DEV
  ? lazy(() => import('./components/KitchenSink').then((m) => ({ default: m.KitchenSink })))
  : null

type View = 'loading' | 'onboarding' | 'flow'

function App(): React.JSX.Element {
  const sink = !!KitchenSink && window.location.hash === '#sink'
  const [view, setView] = useState<View>('loading')
  const [hasKey, setHasKey] = useState(false)
  // Settings reuses the onboarding screen but renders OVER the flow while
  // the flow stays mounted (display:none) — closing it must not lose an
  // in-progress source/metadata edit. History overlays the same way.
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  // A history selection to re-fill the form with. The key forces Flow's
  // effect to re-run even when the same entry is picked twice.
  const [prefill, setPrefill] = useState<HistoryEntry | null>(null)
  const [prefillKey, setPrefillKey] = useState(0)

  function applyHistory(entry: HistoryEntry): void {
    setPrefill(entry)
    setPrefillKey((k) => k + 1)
    setHistoryOpen(false)
  }

  useEffect(() => {
    // window.api only exists inside Electron — a plain browser tab pointed
    // at the dev server (e.g. for the #sink gallery) stays on 'loading'.
    if (!window.api) return
    Promise.all([window.api.hasGeminiKey(), window.api.isOnboarded()]).then(
      ([keySet, onboarded]) => {
        setHasKey(keySet)
        // The key is optional — only the one-time setup screen gates entry.
        setView(onboarded ? 'flow' : 'onboarding')
      }
    )
    // Manual-but-noticed updates: unsigned builds can't self-install, so a
    // newer GitHub release surfaces as a persistent toast instead.
    window.api.onUpdateAvailable((info) => {
      toast(`TrackTag ${info.version} is available`, {
        id: 'app-update',
        action: {
          label: 'Get it',
          onClick: () => window.open(info.url, '_blank')
        }
      })
    })
  }, [])

  function finishOnboarding(keySet: boolean): void {
    setHasKey(keySet)
    setView('flow')
  }

  return (
    <>
      {/* Drag strip for the hiddenInset title bar. */}
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 z-40 h-9"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />
      <GradientDots />
      <PixelCursorTrail />
      <div className="relative">
        {sink && KitchenSink ? (
          <Suspense fallback={null}>
            <KitchenSink />
          </Suspense>
        ) : view === 'onboarding' ? (
          <Onboarding hasKey={hasKey} onDone={finishOnboarding} />
        ) : view === 'flow' ? (
          <>
            {settingsOpen && (
              <Onboarding
                hasKey={hasKey}
                isSettings
                onDone={(keySet) => {
                  setHasKey(keySet)
                  setSettingsOpen(false)
                }}
              />
            )}
            {historyOpen && <History onSelect={applyHistory} />}
            <div className={settingsOpen || historyOpen ? 'hidden' : ''}>
              {/* Keyed so a history selection remounts Flow with the entry
                  applied via state initializers. */}
              <Flow key={prefillKey} canAutofill={hasKey} prefill={prefill} />
            </div>
          </>
        ) : null}
      </div>
      <GithubLink />
      {view === 'flow' && !sink && !settingsOpen && (
        <>
          <SettingsButton
            onClick={() => {
              setHistoryOpen(false)
              setSettingsOpen(true)
            }}
          />
          {historyOpen ? (
            <HomeButton onClick={() => setHistoryOpen(false)} />
          ) : (
            <HistoryButton onClick={() => setHistoryOpen(true)} />
          )}
        </>
      )}
      <Toaster
        theme="dark"
        position="bottom-right"
        closeButton
        toastOptions={{
          duration: Infinity,
          classNames: {
            toast: 'tt-toast',
            error: 'tt-toast--error',
            closeButton: 'tt-toast__close'
          }
        }}
      />
    </>
  )
}

export default App
