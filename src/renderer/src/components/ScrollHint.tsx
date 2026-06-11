import { useEffect, useState } from 'react'

const BOTTOM_SLACK_PX = 48

/**
 * Replaces the (hidden) scrollbar as the "there is more below" signal: a
 * dim bobbing chevron, bottom-right, that fades out once the page bottom
 * is in reach. Mounted only in the editing flow — the centered picker and
 * setup screens never scroll.
 */
export function ScrollHint(): React.JSX.Element {
  const [show, setShow] = useState(false)

  useEffect(() => {
    let raf = 0
    const check = (): void => {
      raf = 0
      const remaining = document.documentElement.scrollHeight - window.scrollY - window.innerHeight
      setShow(remaining > BOTTOM_SLACK_PX)
    }
    const schedule = (): void => {
      if (raf === 0) raf = requestAnimationFrame(check)
    }
    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    // Content height changes without scroll events (sections reveal,
    // trim panel opens, save card animates in) — watch the body too.
    const ro = new ResizeObserver(schedule)
    ro.observe(document.body)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      ro.disconnect()
      if (raf !== 0) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed bottom-5 right-5 z-20 transition-opacity duration-300"
      style={{ opacity: show ? 1 : 0 }}
    >
      <svg
        className="anim-scroll-hint"
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        stroke="var(--color-text-dim)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 8l5 5 5-5" />
      </svg>
    </div>
  )
}
