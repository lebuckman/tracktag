import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { GradientDots } from './components/GradientDots'
import { PixelCursorTrail } from './components/PixelCursorTrail'
import { GithubLink } from './components/GithubLink'
import { SettingsButton } from './components/SettingsButton'
import { KitchenSink } from './components/KitchenSink'
import { Onboarding } from './components/Onboarding'
import { Flow } from './components/Flow'

type View = 'loading' | 'onboarding' | 'flow'

function App(): React.JSX.Element {
  const sink = window.location.hash === '#sink'
  const [view, setView] = useState<View>('loading')
  const [hasKey, setHasKey] = useState(false)

  useEffect(() => {
    // window.api only exists inside Electron — a plain browser tab pointed
    // at the dev server (e.g. for the #sink gallery) stays on 'loading'.
    if (!window.api) return
    Promise.all([window.api.hasGeminiKey(), window.api.isOnboarded()]).then(
      ([keySet, onboarded]) => {
        setHasKey(keySet)
        setView(keySet && onboarded ? 'flow' : 'onboarding')
      }
    )
  }, [])

  function finishOnboarding(): void {
    setHasKey(true)
    setView('flow')
  }

  return (
    <>
      <GradientDots />
      <PixelCursorTrail />
      <div className="relative">
        {sink ? (
          <KitchenSink />
        ) : view === 'onboarding' ? (
          <Onboarding hasKey={hasKey} onDone={finishOnboarding} />
        ) : view === 'flow' ? (
          <Flow />
        ) : null}
      </div>
      <GithubLink />
      {view === 'flow' && !sink && <SettingsButton onClick={() => setView('onboarding')} />}
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
