import { Toaster } from 'sonner'
import { GradientDots } from './components/GradientDots'
import { PixelCursorTrail } from './components/PixelCursorTrail'
import { GithubLink } from './components/GithubLink'
import { KitchenSink } from './components/KitchenSink'

function App(): React.JSX.Element {
  const sink = window.location.hash === '#sink'

  return (
    <>
      <GradientDots />
      <PixelCursorTrail />
      <div className="relative">
        {sink ? (
          <KitchenSink />
        ) : (
          <main className="flex min-h-screen items-center justify-center">
            <h1 className="tt-display text-4xl">TrackTag</h1>
          </main>
        )}
      </div>
      <GithubLink />
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
