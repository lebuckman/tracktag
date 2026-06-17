/**
 * Accented corner affordance for returning to the flow from the history or
 * settings view. Takes the History button's slot, with an accent tint so the
 * "way back" reads clearly. Can be disabled (e.g. unsaved settings).
 */
export function HomeButton({
  onClick,
  disabled = false,
  position = 'history'
}: {
  onClick: () => void
  disabled?: boolean
  /** Which corner slot to occupy: history replaces the history icon (top of
   *  the stack); settings sits directly above GitHub with no gap. */
  position?: 'history' | 'settings'
}): React.JSX.Element {
  const bottom = position === 'settings' ? 'bottom-17' : 'bottom-29'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Back to tagging"
      title={disabled ? 'Save or clear your API key first' : undefined}
      className={`tt-github-link tt-github-link--accent fixed ${bottom} left-5 z-30 flex h-10 w-10 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V20h14V9.5" />
      </svg>
    </button>
  )
}
