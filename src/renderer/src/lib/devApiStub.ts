import type { Api } from '@shared/types'

/**
 * Dev-only stand-in for the preload bridge so the full flow can run in a
 * plain browser tab pointed at the dev server (visual checks, screenshots).
 * Never active inside Electron (window.api exists) or in production builds.
 */
export function installDevApiStub(): void {
  if (!import.meta.env.DEV || window.api) return

  const delay = <T>(value: T, ms = 400): Promise<T> =>
    new Promise((resolve) => setTimeout(() => resolve(value), ms))

  const stub: Api = {
    fetchVideoInfo: (url) =>
      delay({
        ok: true as const,
        source: {
          kind: 'youtube' as const,
          url,
          videoId: 'dQw4w9WgXcQ',
          title: 'Stub Video Title',
          thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
          channel: 'Stub Channel'
        }
      }),
    fetchVideoDuration: () => delay(213),
    prefillMetadata: () =>
      delay(
        {
          ok: true as const,
          data: { title: 'CINEMA', artist: 'WOODZ', album: '2025 INDEX_00 PREVIEW CONCERT' }
        },
        900
      ),
    saveFile: (payload) =>
      delay({ ok: true as const, savedPath: `${payload.folder}/${payload.fileName}` }, 1500),
    pickFolder: () => delay({ ok: true as const, folder: '/Users/dev/Music/Tagged' }),
    revealItem: () => delay({ ok: true }),
    readLastFolder: () => delay(''),
    setLastFolder: () => delay(undefined),
    getPathForFile: (file) => `/Users/dev/Downloads/${file.name}`,
    hasGeminiKey: () => delay(true, 50),
    getGeminiKey: () => delay('AIzaSyStubKey-1234567890abcdef'),
    setGeminiKey: () => delay(undefined),
    isOnboarded: () => delay(true, 50),
    setOnboarded: () => delay(undefined),
    getHistory: () =>
      delay([
        {
          id: 'stub-1',
          savedAt: Date.now() - 1000 * 60 * 60 * 3,
          kind: 'youtube' as const,
          sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
          title: 'CINEMA',
          artist: 'WOODZ',
          album: '2025 INDEX_00 PREVIEW CONCERT',
          fileName: 'woodz_cinema.mp3'
        },
        {
          id: 'stub-2',
          savedAt: Date.now() - 1000 * 60 * 60 * 28,
          kind: 'file' as const,
          sourceFilename: 'rehearsal-take.wav',
          sourceFilePath: '/Users/dev/Downloads/rehearsal-take.wav',
          title: 'Rehearsal Take',
          artist: '',
          album: '',
          fileName: 'rehearsal-take.mp3'
        }
      ]),
    deleteHistoryEntry: () => delay(undefined),
    clearHistory: () => delay(undefined),
    onUpdateAvailable: () => {}
  }

  window.api = stub
}
