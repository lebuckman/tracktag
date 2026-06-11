import type { Api } from '@shared/types'

/**
 * Dev-only stand-in for the preload bridge so the full flow can run in a
 * plain browser tab pointed at the dev server (visual checks, screenshots).
 * Never active inside Electron (window.api exists) or in production builds.
 */
export function installDevApiStub(): void {
  if (!import.meta.env.DEV || window.api) return

  const delay = <T,>(value: T, ms = 400): Promise<T> =>
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
    readLastFolder: () => delay(''),
    setLastFolder: () => delay(undefined),
    getPathForFile: (file) => `/Users/dev/Downloads/${file.name}`,
    hasGeminiKey: () => delay(true, 50),
    setGeminiKey: () => delay(undefined),
    isOnboarded: () => delay(true, 50),
    setOnboarded: () => delay(undefined),
    onUpdateAvailable: () => {}
  }

  window.api = stub
}
