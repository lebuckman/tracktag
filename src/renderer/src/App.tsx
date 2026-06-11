import { lazy, Suspense, useEffect, useState } from 'react'
import { toast, Toaster } from 'sonner'
import { GradientDots } from './components/GradientDots'
import { PixelCursorTrail } from './components/PixelCursorTrail'
import { GithubLink } from './components/GithubLink'
import { SettingsButton } from './components/SettingsButton'
import { Onboarding } from './components/Onboarding'
import { Flow } from './components/Flow'
import { installDevApiStub } from './lib/devApiStub'

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
  // in-progress source/metadata edit.
  const [settingsOpen, setSettingsOpen] = useState(false)

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
                onDone={(keySet) => {
                  setHasKey(keySet)
                  setSettingsOpen(false)
                }}
              />
            )}
            <div className={settingsOpen ? 'hidden' : ''}>
              <Flow canAutofill={hasKey} />
            </div>
          </>
        ) : null}
      </div>
      <GithubLink />
      {view === 'flow' && !sink && !settingsOpen && (
        <SettingsButton onClick={() => setSettingsOpen(true)} />
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
