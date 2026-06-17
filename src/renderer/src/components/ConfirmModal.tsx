import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useFocusTrap } from '../lib/useFocusTrap'
import { EASE } from '../lib/motion'

type Props = {
  title: string
  body?: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

/** Small centered confirmation dialog for destructive actions. */
export function ConfirmModal({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel
}: Props): React.JSX.Element {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const cancelRef = useRef<HTMLButtonElement | null>(null)
  // Focus the safe option, so a stray Enter cancels rather than confirms a
  // destructive action; the user must tab to confirm to activate it.
  useFocusTrap(dialogRef, cancelRef)

  // Esc cancels. Enter is intentionally not handled globally — it activates
  // whichever button is focused (Cancel by default).
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center px-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{ background: 'rgba(6,6,9,0.78)' }}
        onClick={onCancel}
      >
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          className="tt-card w-full max-w-sm px-7 py-8 text-center outline-none"
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.26, ease: EASE }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2
            className="text-xl"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--color-text)'
            }}
          >
            {title}
          </h2>
          {body && (
            <p
              className="mx-auto mt-3 max-w-xs text-sm"
              style={{ color: 'var(--color-text-muted)', textWrap: 'pretty' }}
            >
              {body}
            </p>
          )}
          <div className="mt-7 flex items-center justify-center gap-3">
            <button ref={cancelRef} type="button" onClick={onCancel} className="tt-btn">
              Cancel
            </button>
            <button type="button" onClick={onConfirm} className="tt-btn tt-btn-primary">
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
