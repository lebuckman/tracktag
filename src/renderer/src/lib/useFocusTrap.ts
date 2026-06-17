import { useEffect, type RefObject } from 'react'

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Modal focus management: move focus into the container on open, keep Tab
 * cycling within it, and restore focus to the previously-focused element on
 * close. The container should carry tabIndex={-1} so it can hold focus when
 * it has no focusable children yet.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  initialFocus?: RefObject<HTMLElement | null>
): void {
  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    const previouslyFocused = document.activeElement as HTMLElement | null

    function focusables(): HTMLElement[] {
      return Array.from(node!.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null
      )
    }

    // Focus the requested control if given, else the dialog itself so screen
    // readers announce it and Tab steps through from the top.
    ;(initialFocus?.current ?? node).focus()

    function onKey(e: KeyboardEvent): void {
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey) {
        if (active === first || active === node || !node!.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else if (active === last || !node!.contains(active)) {
        e.preventDefault()
        first.focus()
      }
    }

    node.addEventListener('keydown', onKey)
    return () => {
      node.removeEventListener('keydown', onKey)
      // Only restore to a real, still-present element. Restoring to <body>
      // (common when the opener was a label or native file dialog) would send
      // the next Tab to the top of the page, so leave focus alone instead.
      if (
        previouslyFocused &&
        previouslyFocused !== document.body &&
        document.contains(previouslyFocused)
      ) {
        previouslyFocused.focus?.()
      }
    }
  }, [ref, initialFocus])
}
