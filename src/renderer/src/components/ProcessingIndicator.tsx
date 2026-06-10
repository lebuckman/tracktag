const BARS = 14

export function ProcessingIndicator({ label }: { label: string }): React.JSX.Element {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-6.5 items-center gap-0.75">
        {Array.from({ length: BARS }).map((_, i) => (
          <span
            key={i}
            className="waveform-bar"
            style={{
              animationDelay: `${i * 70}ms`,
              opacity: 0.45 + (i % 3) * 0.18
            }}
          />
        ))}
      </div>
      <p
        className="text-[0.7rem] uppercase tracking-[0.12em]"
        style={{
          fontFamily: 'var(--font-mono)',
          color: 'var(--color-text-muted)'
        }}
      >
        {label}
      </p>
    </div>
  )
}
