import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SourceSelector } from './SourceSelector'
import { MetadataForm } from './MetadataForm'
import { SaveControls } from './SaveControls'
import { ScrollHint } from './ScrollHint'
import type { Metadata, Source, TrimRange } from '@shared/types'

const EMPTY_TRIM: TrimRange = { startSec: null, endSec: null }
const EMPTY_METADATA: Metadata = {
  title: '',
  artists: [],
  album: '',
  fileName: ''
}

const EASE = [0.2, 0.7, 0.2, 1] as const

export function Flow({ canAutofill }: { canAutofill: boolean }): React.JSX.Element {
  const [source, setSource] = useState<Source | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [trim, setTrim] = useState<TrimRange>(EMPTY_TRIM)
  const [metadata, setMetadata] = useState<Metadata>(EMPTY_METADATA)
  const [resetKey, setResetKey] = useState(0)

  function reset(): void {
    setSource(null)
    setFile(null)
    setTrim(EMPTY_TRIM)
    setMetadata(EMPTY_METADATA)
    setResetKey((k) => k + 1)
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!source ? (
        <motion.div
          key={`pick-${resetKey}`}
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.985 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="flex min-h-screen items-center justify-center px-6"
        >
          <div className="w-full max-w-xl">
            <SourceSelector
              compact
              source={null}
              onSource={(s, f) => {
                setSource(s)
                setFile(f)
              }}
            />
          </div>
        </motion.div>
      ) : (
        <motion.div
          key={`edit-${resetKey}`}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.05 }}
          className="mx-auto flex max-w-3xl flex-col gap-14 px-8 pt-20 pb-40"
        >
          <SourceSelector
            source={source}
            onSource={(s, f) => {
              setSource(s)
              setFile(f)
              if (!s) {
                setTrim(EMPTY_TRIM)
                setMetadata(EMPTY_METADATA)
              }
            }}
            trim={trim}
            onTrimChange={setTrim}
          />
          {/* Grouped with the same gap as the metadata fields so the
              File name → Folder spacing reads as one continuous form. */}
          <div className="flex flex-col gap-7">
            <Reveal delay={0.18}>
              <MetadataForm
                source={source}
                metadata={metadata}
                onChange={setMetadata}
                canAutofill={canAutofill}
              />
            </Reveal>
            <Reveal delay={0.28}>
              <SaveControls
                source={source}
                file={file}
                trim={trim}
                metadata={metadata}
                onSaved={reset}
              />
            </Reveal>
          </div>
          <ScrollHint />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Reveal({
  children,
  delay
}: {
  children: React.ReactNode
  delay: number
}): React.JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  )
}
