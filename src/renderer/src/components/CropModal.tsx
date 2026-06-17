import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useFocusTrap } from '../lib/useFocusTrap'
import { EASE } from '../lib/motion'

type Props = {
  /** Source image as a data URL (already read from the picked file). */
  src: string
  /** Original mime, used as-is when the user keeps the full image. */
  mime: string
  onCancel: () => void
  onConfirm: (dataUrl: string, mime: string) => void
}

type Mode = 'square' | 'original'

// On-screen viewport edge and exported square size. The export is fixed at
// 640px — comfortably above the 300px streaming thumbnails embed at, without
// bloating the data URL the way a full-res crop would.
const VIEW = 300
const OUT = 640
const MAX_ZOOM = 4

export function CropModal({ src, mime, onCancel, onConfirm }: Props): React.JSX.Element {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const confirmRef = useRef<HTMLButtonElement | null>(null)
  useFocusTrap(dialogRef, confirmRef)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [mode, setMode] = useState<Mode>('square')
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [grabbing, setGrabbing] = useState(false)
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null)
  // Refs mirror the live geometry so the native wheel listener (below) reads
  // current values without re-subscribing on every zoom tick.
  const zoomRef = useRef(1)
  const offsetRef = useRef({ x: 0, y: 0 })

  function applyZoom(z: number): void {
    zoomRef.current = z
    setZoom(z)
  }
  function applyOffset(o: { x: number; y: number }): void {
    offsetRef.current = o
    setOffset(o)
  }

  function clampTo(x: number, y: number, w: number, h: number): { x: number; y: number } {
    return { x: Math.min(0, Math.max(VIEW - w, x)), y: Math.min(0, Math.max(VIEW - h, y)) }
  }

  // Load the bitmap once to get its natural size, then center it. Both
  // setState calls run inside the async onload callback, so the geometry is
  // established without a synchronous effect cascade.
  useEffect(() => {
    const img = new Image()
    img.onload = (): void => {
      imgRef.current = img
      const w = img.naturalWidth
      const h = img.naturalHeight
      setNatural({ w, h })
      const cs = Math.max(VIEW / w, VIEW / h)
      applyOffset({ x: Math.min(0, (VIEW - w * cs) / 2), y: Math.min(0, (VIEW - h * cs) / 2) })
    }
    img.src = src
  }, [src])

  // Lock background scroll while the modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Esc cancels, mirroring the native close affordance.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  // Wheel zoom via a non-passive native listener so preventDefault works and
  // the scroll never leaks to the page behind the modal.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return undefined
    function onWheelNative(e: WheelEvent): void {
      e.preventDefault()
      if (mode !== 'square' || !natural) return
      const cs = Math.max(VIEW / natural.w, VIEW / natural.h)
      const nextZoom = Math.min(MAX_ZOOM, Math.max(1, zoomRef.current - e.deltaY * 0.002))
      const nW = natural.w * cs * nextZoom
      const nH = natural.h * cs * nextZoom
      applyZoom(nextZoom)
      applyOffset(clampTo(offsetRef.current.x, offsetRef.current.y, nW, nH))
    }
    el.addEventListener('wheel', onWheelNative, { passive: false })
    return () => el.removeEventListener('wheel', onWheelNative)
  }, [mode, natural])

  // The scale that makes the image just cover the square at zoom 1.
  const coverScale = natural ? Math.max(VIEW / natural.w, VIEW / natural.h) : 1
  const drawW = natural ? natural.w * coverScale * zoom : VIEW
  const drawH = natural ? natural.h * coverScale * zoom : VIEW

  function onPointerDown(e: React.PointerEvent): void {
    if (mode !== 'square') return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = {
      px: e.clientX,
      py: e.clientY,
      ox: offsetRef.current.x,
      oy: offsetRef.current.y
    }
    setGrabbing(true)
  }

  function onPointerMove(e: React.PointerEvent): void {
    if (!drag.current) return
    applyOffset(
      clampTo(
        drag.current.ox + (e.clientX - drag.current.px),
        drag.current.oy + (e.clientY - drag.current.py),
        drawW,
        drawH
      )
    )
  }

  function onPointerUp(): void {
    drag.current = null
    setGrabbing(false)
  }

  function confirm(): void {
    // "Original" keeps the source bytes — no crop, no re-encode loss.
    if (mode === 'original' || !natural || !imgRef.current) {
      onConfirm(src, mime)
      return
    }
    // Map the viewport square back to source pixels.
    const scale = coverScale * zoom
    const sx = -offset.x / scale
    const sy = -offset.y / scale
    const sSize = VIEW / scale

    const canvas = document.createElement('canvas')
    canvas.width = OUT
    canvas.height = OUT
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      onConfirm(src, mime)
      return
    }
    try {
      ctx.drawImage(imgRef.current, sx, sy, sSize, sSize, 0, 0, OUT, OUT)
      onConfirm(canvas.toDataURL('image/jpeg', 0.92), 'image/jpeg')
    } catch {
      // A tainted canvas (e.g. some SVG sources) blocks export — fall back
      // to the original image rather than throwing.
      onConfirm(src, mime)
    }
  }

  // Portal to the body so the fixed overlay anchors to the viewport — inside
  // the flow it would land inside a framer-motion transformed ancestor, which
  // becomes the containing block and clips/offsets the modal.
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
          aria-label="Crop cover"
          tabIndex={-1}
          className="tt-card w-full max-w-md p-7 outline-none"
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.28, ease: EASE }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-5 flex items-center justify-between">
            <p className="tt-label leading-none">Crop cover</p>
            <div
              role="tablist"
              aria-label="Crop ratio"
              className="inline-flex items-center gap-1 rounded-xl border p-1"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-elev-1)' }}
            >
              {(['square', 'original'] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className="tt-tab"
                >
                  {m === 'square' ? 'Square' : 'Original'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-center">
            {mode === 'square' ? (
              <div
                ref={viewportRef}
                className="relative overflow-hidden rounded-md"
                style={{
                  width: VIEW,
                  height: VIEW,
                  background: 'var(--color-elev-1)',
                  border: '1px solid var(--color-border)',
                  cursor: grabbing ? 'grabbing' : 'grab',
                  touchAction: 'none'
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                {natural && (
                  <img
                    src={src}
                    alt=""
                    draggable={false}
                    className="absolute select-none"
                    style={{
                      left: offset.x,
                      top: offset.y,
                      width: drawW,
                      height: drawH,
                      maxWidth: 'none'
                    }}
                  />
                )}
                {/* Center grid lines as a framing aid. */}
                <div className="pointer-events-none absolute inset-0">
                  <div
                    className="absolute inset-y-0"
                    style={{ left: '33.33%', width: 1, background: 'rgba(255,255,255,0.12)' }}
                  />
                  <div
                    className="absolute inset-y-0"
                    style={{ left: '66.66%', width: 1, background: 'rgba(255,255,255,0.12)' }}
                  />
                  <div
                    className="absolute inset-x-0"
                    style={{ top: '33.33%', height: 1, background: 'rgba(255,255,255,0.12)' }}
                  />
                  <div
                    className="absolute inset-x-0"
                    style={{ top: '66.66%', height: 1, background: 'rgba(255,255,255,0.12)' }}
                  />
                </div>
              </div>
            ) : (
              <div
                className="flex items-center justify-center rounded-md"
                style={{
                  width: VIEW,
                  height: VIEW,
                  background: 'var(--color-elev-1)',
                  border: '1px solid var(--color-border)'
                }}
              >
                <img
                  src={src}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                  draggable={false}
                />
              </div>
            )}
          </div>

          <p
            className="mt-4 text-center text-[0.7rem] uppercase tracking-[0.12em]"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-dim)' }}
          >
            {mode === 'square' ? 'Drag to position · scroll to zoom' : 'Keeps the full image'}
          </p>

          <div className="mt-6 flex items-center justify-center gap-3">
            <button type="button" onClick={onCancel} className="tt-btn tt-btn-ghost">
              Cancel
            </button>
            <button
              ref={confirmRef}
              type="button"
              onClick={confirm}
              className="tt-btn tt-btn-primary"
            >
              Use image
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
