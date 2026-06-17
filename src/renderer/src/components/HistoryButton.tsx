/**
 * Corner affordance for opening the save history. Stacked above the
 * settings and GitHub links, bottom-left, sharing their visual language.
 */
export function HistoryButton({ onClick }: { onClick: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open history"
      className="tt-github-link fixed bottom-29 left-5 z-30 flex h-10 w-10 items-center justify-center rounded-full"
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
        <path d="M3 3v5h5" />
        <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
        <path d="M12 7v5l4 2" />
      </svg>
    </button>
  )
}
