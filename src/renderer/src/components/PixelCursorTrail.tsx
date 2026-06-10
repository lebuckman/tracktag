import { useEffect, useRef, useState } from 'react'

interface Pixel {
  id: number
  x: number
  y: number
  opacity: number
  age: number
}

const PIXEL_SIZE = 12
const TRAIL_LENGTH = 40
const FADE_SPEED = 0.04

/**
 * Ambient cursor-trail background. Listens to window mouse movement and drops
 * a fading pixel every PIXEL_SIZE pixels of travel. Sits behind page content
 * with `pointer-events: none` so it never blocks interactions.
 */
export function PixelCursorTrail(): React.JSX.Element {
  const [pixels, setPixels] = useState<Pixel[]>([])
  const pixelIdRef = useRef(0)
  const lastPositionRef = useRef({ x: -Infinity, y: -Infinity })
  // Mirrors the live pixel array so both the mouse handler and the fade
  // tick can read the latest value synchronously. setPixels alone isn't
  // enough — React batches state updates, so a functional updater can't
  // be relied on to run before the line that decides whether to keep the
  // RAF loop alive.
  const pixelsRef = useRef<Pixel[]>([])

  // Single effect owns the entire lifecycle: append pixels on mouse move,
  // run the fade loop only while there are pixels to animate.
  useEffect(() => {
    let raf = 0

    const tick = (): void => {
      const current = pixelsRef.current
      if (current.length === 0) {
        raf = 0
        return
      }
      const next = current
        .map((p) => ({
          ...p,
          opacity: p.opacity - FADE_SPEED,
          age: p.age + 1
        }))
        .filter((p) => p.opacity > 0)
      pixelsRef.current = next
      setPixels(next)
      raf = next.length > 0 ? requestAnimationFrame(tick) : 0
    }

    function onMove(e: MouseEvent): void {
      const { clientX: x, clientY: y } = e
      const dx = x - lastPositionRef.current.x
      const dy = y - lastPositionRef.current.y
      if (dx * dx + dy * dy > PIXEL_SIZE * PIXEL_SIZE) {
        // Keep room for the new pixel so the array stays strictly at
        // TRAIL_LENGTH, not TRAIL_LENGTH + 1.
        const next = [
          ...pixelsRef.current.slice(-(TRAIL_LENGTH - 1)),
          {
            id: pixelIdRef.current++,
            x,
            y,
            opacity: 1,
            age: 0
          }
        ]
        pixelsRef.current = next
        setPixels(next)
        lastPositionRef.current = { x, y }
        // Restart the fade loop if it stopped while the trail was empty.
        if (raf === 0) raf = requestAnimationFrame(tick)
      }
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      if (raf !== 0) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {pixels.map((pixel) => {
        // Older pixels shrink slightly for a tapering trail.
        const sizeMultiplier = Math.max(0.3, 1 - pixel.age / 100)
        const size = PIXEL_SIZE * sizeMultiplier
        return (
          <div
            key={pixel.id}
            className="absolute rounded-full"
            style={{
              left: pixel.x - size / 2,
              top: pixel.y - size / 2,
              width: size,
              height: size,
              opacity: pixel.opacity,
              background: 'rgba(255, 255, 255, 1)',
              mixBlendMode: 'screen',
              boxShadow:
                '0 0 6px rgba(255, 255, 255, 1), 0 0 18px rgba(255, 255, 255, 0.85), 0 0 40px rgba(255, 255, 255, 0.45), 0 0 80px rgba(255, 255, 255, 0.2)',
              transition: 'width 0.1s ease-out, height 0.1s ease-out'
            }}
          />
        )
      })}
    </div>
  )
}
