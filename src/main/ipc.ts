import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { app, dialog, ipcMain, BrowserWindow } from 'electron'

import { downloadAudio, fetchDuration, fetchYouTubeMeta } from './lib/ytdlp'
import { convertToMp3 } from './lib/ffmpeg'
import { writeTags } from './lib/id3'
import { prefillFromText } from './lib/gemini'
import { parseVideoId, thumbnailUrl, watchUrl } from './lib/youtube'
import { sanitizeFileName } from '../shared/filename'
import {
  getLastSaveFolder,
  setLastSaveFolder,
  getGeminiKey,
  setGeminiKey,
  isOnboarded,
  setOnboarded
} from './store'
import type {
  PickFolderResult,
  PrefillInput,
  PrefillOutcome,
  SavePayload,
  SaveResult,
  VideoInfoResult
} from '../shared/types'

function scratchRoot(): string {
  return path.join(app.getPath('userData'), 'scratch')
}

function expandHome(folder: string): string {
  if (folder.startsWith('~')) {
    return path.join(os.homedir(), folder.slice(1))
  }
  return folder
}

async function isDirectory(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p)
    return stat.isDirectory()
  } catch {
    return false
  }
}

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mime: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) throw new Error('Invalid album art data')
  return { mime: match[1], buffer: Buffer.from(match[2], 'base64') }
}

async function fetchVideoInfo(rawUrl: string): Promise<VideoInfoResult> {
  const videoId = parseVideoId(rawUrl)
  if (!videoId) {
    return { ok: false, error: 'Not a valid YouTube URL' }
  }

  const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    watchUrl(videoId)
  )}&format=json`

  try {
    const res = await fetch(oembed, { cache: 'no-store' })
    if (!res.ok) {
      return {
        ok: false,
        error: res.status === 404 ? 'Video not found or private' : `YouTube returned ${res.status}`
      }
    }
    const data = (await res.json()) as {
      title?: string
      author_name?: string
    }
    return {
      ok: true,
      source: {
        kind: 'youtube',
        url: watchUrl(videoId),
        videoId,
        title: data.title ?? 'Untitled',
        thumbnail: thumbnailUrl(videoId),
        channel: data.author_name?.trim() || undefined
      }
    }
  } catch {
    return { ok: false, error: 'Could not reach YouTube' }
  }
}

async function prefillMetadata(input: PrefillInput): Promise<PrefillOutcome> {
  try {
    let title = ''
    let description = ''

    if (input.kind === 'youtube') {
      try {
        const meta = await fetchYouTubeMeta(input.url)
        title = meta.title
        description = meta.description
      } catch {
        title = input.fallbackTitle
      }
    } else {
      title = input.filename.replace(/\.[^.]+$/, '')
    }

    if (!title && !description) {
      return { ok: false, error: 'No source text to send to AI' }
    }

    const data = await prefillFromText(title, description)
    return { ok: true, data }
  } catch (err) {
    console.error('[prefillMetadata]', err)
    const message = err instanceof Error ? err.message : 'Autofill failed'
    return { ok: false, error: message }
  }
}

async function saveFile(payload: SavePayload): Promise<SaveResult> {
  const sessionId = randomUUID()
  const workDir = path.join(scratchRoot(), sessionId)

  try {
    const title = payload.title.trim()
    const artist = payload.artist.trim()
    const album = payload.album.trim()
    const rawFileName = payload.fileName.trim()
    const rawFolder = payload.folder.trim()
    const start = payload.trimStartSec
    const end = payload.trimEndSec

    if (!rawFileName) return { ok: false, error: 'File name is required' }
    if (!rawFolder) return { ok: false, error: 'Save folder is required' }

    const fileName = sanitizeFileName(rawFileName)
    if (!fileName) return { ok: false, error: 'File name has no usable characters' }

    const folder = expandHome(rawFolder)
    if (!path.isAbsolute(folder)) return { ok: false, error: 'Folder must be an absolute path' }
    if (!(await isDirectory(folder))) return { ok: false, error: 'Folder does not exist' }

    if (start != null && end != null && end <= start) {
      return { ok: false, error: 'Trim end must be after start' }
    }

    await fs.mkdir(workDir, { recursive: true })

    const trim = start != null || end != null ? { start, end } : undefined

    // Two-step: get raw audio → ffmpeg trim/convert → final.mp3
    // Always pipe through ffmpeg if trim is set, so trim is exact.
    const finalIntermediate = path.join(workDir, 'final.mp3')

    if (payload.kind === 'youtube') {
      if (!payload.url) return { ok: false, error: 'Missing YouTube URL' }

      const downloaded = path.join(workDir, 'raw.mp3')
      await downloadAudio(payload.url, downloaded)

      if (trim) {
        await convertToMp3(downloaded, finalIntermediate, trim)
      } else {
        await fs.rename(downloaded, finalIntermediate)
      }
    } else {
      // The renderer hands over a real on-disk path (via webUtils), so the
      // input is read in place — no upload copy like the web version needed.
      if (!payload.filePath || !path.isAbsolute(payload.filePath)) {
        return { ok: false, error: 'Missing source file path' }
      }
      try {
        await fs.access(payload.filePath)
      } catch {
        return { ok: false, error: 'Source file no longer exists' }
      }
      await convertToMp3(payload.filePath, finalIntermediate, trim)
    }

    const albumArt =
      payload.albumArtDataUrl && payload.albumArtDataUrl.startsWith('data:')
        ? dataUrlToBuffer(payload.albumArtDataUrl)
        : undefined

    writeTags(finalIntermediate, {
      title: title || undefined,
      artist: artist || undefined,
      album: album || undefined,
      albumArt
    })

    const finalPath = path.join(folder, fileName)
    await fs.rename(finalIntermediate, finalPath).catch(async (err) => {
      if ((err as NodeJS.ErrnoException).code === 'EXDEV') {
        await fs.copyFile(finalIntermediate, finalPath)
        await fs.unlink(finalIntermediate)
      } else {
        throw err
      }
    })

    // The file is already on disk at this point. Persisting the last-used
    // folder is best-effort — failing here must not flip the action to an
    // error, or the user retries and produces a duplicate file.
    try {
      setLastSaveFolder(folder)
    } catch (err) {
      console.error('[saveFile] could not persist last folder', err)
    }

    return { ok: true, savedPath: finalPath }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Save failed'
    return { ok: false, error: message }
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}

async function pickFolder(win: BrowserWindow | null): Promise<PickFolderResult> {
  const options = {
    properties: ['openDirectory', 'createDirectory'] as Array<'openDirectory' | 'createDirectory'>,
    defaultPath: getLastSaveFolder() || undefined
  }
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options)
  if (result.canceled || result.filePaths.length === 0) {
    // Cancel is not an error state — the renderer treats it as a no-op.
    return { ok: false, error: 'canceled' }
  }
  return { ok: true, folder: result.filePaths[0] }
}

export function registerIpcHandlers(): void {
  ipcMain.handle('fetchVideoInfo', (_e, url: string) => fetchVideoInfo(url))
  ipcMain.handle('fetchVideoDuration', (_e, url: string) => fetchDuration(url))
  ipcMain.handle('prefillMetadata', (_e, input: PrefillInput) => prefillMetadata(input))
  ipcMain.handle('saveFile', (_e, payload: SavePayload) => saveFile(payload))
  ipcMain.handle('pickFolder', (e) => pickFolder(BrowserWindow.fromWebContents(e.sender)))
  ipcMain.handle('readLastFolder', () => getLastSaveFolder())
  ipcMain.handle('setLastFolder', (_e, folder: string) => setLastSaveFolder(folder))
  ipcMain.handle('hasGeminiKey', () => getGeminiKey().length > 0)
  // Read-back exists solely for the settings "show key" toggle.
  ipcMain.handle('getGeminiKey', () => getGeminiKey())
  ipcMain.handle('setGeminiKey', (_e, key: string) => setGeminiKey(key))
  ipcMain.handle('isOnboarded', () => isOnboarded())
  ipcMain.handle('setOnboarded', () => setOnboarded())
}

/** Remove any scratch dirs left behind by a crashed previous run. */
export async function cleanScratch(): Promise<void> {
  await fs.rm(scratchRoot(), { recursive: true, force: true }).catch(() => {})
}
