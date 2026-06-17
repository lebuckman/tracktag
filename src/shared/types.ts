export type YouTubeSource = {
  kind: 'youtube'
  url: string
  videoId: string
  title: string
  thumbnail: string
  channel?: string
  duration?: number
}

export type FileSource = {
  kind: 'file'
  filename: string
  size: number
  duration?: number
}

export type Source = YouTubeSource | FileSource

export type TrimRange = {
  startSec: number | null
  endSec: number | null
}

export type Metadata = {
  title: string
  artists: string[]
  album: string
  fileName: string
  albumArt?: {
    dataUrl: string
    mime: string
  }
}

export type PrefillResult = {
  title: string
  artist: string
  album: string
}

export type PrefillInput =
  | { kind: 'youtube'; url: string; fallbackTitle: string }
  | { kind: 'file'; filename: string }

export type VideoInfoResult = { ok: true; source: YouTubeSource } | { ok: false; error: string }

export type PrefillOutcome = { ok: true; data: PrefillResult } | { ok: false; error: string }

export type SaveResult =
  | { ok: true; savedPath: string }
  // The destination already holds a file with this name; the renderer asks
  // the user to overwrite or keep both, then re-saves with `onConflict` set.
  | { ok: false; conflict: true; fileName: string }
  | { ok: false; error: string }

export type PickFolderResult = { ok: true; folder: string } | { ok: false; error: string }

/** Optional post-decode audio processing applied during the ffmpeg pass. */
export type AudioOpts = {
  fade: boolean
  normalize: boolean
}

type SaveCommon = {
  title: string
  artist: string
  album: string
  fileName: string
  folder: string
  trimStartSec?: number
  trimEndSec?: number
  albumArtDataUrl?: string
  fade?: boolean
  normalize?: boolean
  // How to resolve a filename collision; absent on the first attempt.
  onConflict?: 'overwrite' | 'keepBoth'
}

export type SavePayload =
  | ({ kind: 'youtube'; url: string } & SaveCommon)
  | ({ kind: 'file'; filePath: string } & SaveCommon)

/**
 * One past save, persisted in the main-process store. Cover art is never
 * stored here — only the YouTube thumbnail URL — to keep the JSON small.
 */
export type HistoryEntry = {
  id: string
  savedAt: number
  kind: 'youtube' | 'file'
  /** YouTube source URL (kind === 'youtube'). */
  sourceUrl?: string
  /** Original file name (kind === 'file'). */
  sourceFilename?: string
  /** Original on-disk path (kind === 'file'), for source re-resolution. */
  sourceFilePath?: string
  title: string
  artist: string
  album: string
  fileName: string
  /** YouTube thumbnail URL (kind === 'youtube'). */
  thumbnail?: string
}

/** The window.api surface exposed by the preload bridge. */
export type Api = {
  fetchVideoInfo: (url: string) => Promise<VideoInfoResult>
  fetchVideoDuration: (url: string) => Promise<number | null>
  prefillMetadata: (input: PrefillInput) => Promise<PrefillOutcome>
  saveFile: (payload: SavePayload) => Promise<SaveResult>
  pickFolder: () => Promise<PickFolderResult>
  /** Reveal a saved file in Finder; { ok: false } if it has moved/been deleted. */
  revealItem: (filePath: string) => Promise<{ ok: boolean }>
  readLastFolder: () => Promise<string>
  setLastFolder: (folder: string) => Promise<void>
  /** Resolve the on-disk path of a dropped/picked File (Electron webUtils). */
  getPathForFile: (file: File) => string
  hasGeminiKey: () => Promise<boolean>
  getGeminiKey: () => Promise<string>
  setGeminiKey: (key: string) => Promise<void>
  isOnboarded: () => Promise<boolean>
  setOnboarded: () => Promise<void>
  /** Past saves, newest first. */
  getHistory: () => Promise<HistoryEntry[]>
  deleteHistoryEntry: (id: string) => Promise<void>
  clearHistory: () => Promise<void>
  /** Fired when a newer GitHub release of the app exists. */
  onUpdateAvailable: (cb: (info: AppUpdateInfo) => void) => void
}

export type AppUpdateInfo = { version: string; url: string }
