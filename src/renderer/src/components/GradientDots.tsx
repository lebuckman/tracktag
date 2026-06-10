import React from 'react'
import { motion } from 'framer-motion'

type GradientDotsProps = React.ComponentProps<typeof motion.div> & {
  /** Dot size (default: 8) */
  dotSize?: number
  /** Spacing between dots (default: 10) */
  spacing?: number
  /** Animation duration (default: 30) */
  duration?: number
  /** Background color (default: 'var(--color-bg)') */
  backgroundColor?: string
}

/**
 * Animated dot grid background with cycling hue rotation. Mounts as a
 * fixed full-viewport layer; pointer-events disabled so the page stays
 * interactive.
 */
export function GradientDots({
  dotSize = 8,
  spacing = 10,
  duration = 30,
  backgroundColor = 'var(--color-bg)',
  className,
  style,
  ...props
}: GradientDotsProps): React.JSX.Element {
  const hexSpacing = spacing * 1.732

  return (
    <motion.div
      aria-hidden
      className={`pointer-events-none fixed inset-0 ${className ?? ''}`}
      style={{
        backgroundColor,
        filter: 'grayscale(1) brightness(0.55)',
        backgroundImage: `
          radial-gradient(circle at 50% 50%, transparent 1.5px, ${backgroundColor} 0 ${dotSize}px, transparent ${dotSize}px),
          radial-gradient(circle at 50% 50%, transparent 1.5px, ${backgroundColor} 0 ${dotSize}px, transparent ${dotSize}px),
          radial-gradient(circle at 50% 50%, #f00, transparent 60%),
          radial-gradient(circle at 50% 50%, #ff0, transparent 60%),
          radial-gradient(circle at 50% 50%, #0f0, transparent 60%),
          radial-gradient(ellipse at 50% 50%, #00f, transparent 60%)
        `,
        backgroundSize: `
          ${spacing}px ${hexSpacing}px,
          ${spacing}px ${hexSpacing}px,
          200% 200%,
          200% 200%,
          200% 200%,
          200% ${hexSpacing}px
        `,
        backgroundPosition: `
          0px 0px, ${spacing / 2}px ${hexSpacing / 2}px,
          0% 0%,
          0% 0%,
          0% 0px
        `,
        ...style
      }}
      animate={{
        backgroundPosition: [
          `0px 0px, ${spacing / 2}px ${hexSpacing / 2}px, 800% 400%, 1000% -400%, -1200% -600%, 400% ${hexSpacing}px`,
          `0px 0px, ${spacing / 2}px ${hexSpacing / 2}px, 0% 0%, 0% 0%, 0% 0%, 0% 0%`
        ]
      }}
      transition={{
        backgroundPosition: {
          duration: duration,
          ease: 'linear',
          repeat: Number.POSITIVE_INFINITY
        }
      }}
      {...props}
    />
  )
}
