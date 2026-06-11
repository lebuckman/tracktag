import Store from 'electron-store'

type ConfigSchema = {
  lastSaveFolder?: string
  geminiApiKey?: string
  onboarded?: boolean
  lastYtdlpCheck?: number
}

// The Gemini key lives only in this store, read only by the main process.
// The renderer can set it and ask whether one exists — never read it back.
const store = new Store<ConfigSchema>()

export function getLastSaveFolder(): string {
  return store.get('lastSaveFolder', '')
}

export function setLastSaveFolder(folder: string): void {
  store.set('lastSaveFolder', folder)
}

export function getGeminiKey(): string {
  return store.get('geminiApiKey', '')
}

export function setGeminiKey(key: string): void {
  store.set('geminiApiKey', key.trim())
}

export function getLastYtdlpCheck(): number {
  return store.get('lastYtdlpCheck', 0)
}

export function setLastYtdlpCheck(ts: number): void {
  store.set('lastYtdlpCheck', ts)
}

export function isOnboarded(): boolean {
  return store.get('onboarded', false)
}

export function setOnboarded(): void {
  store.set('onboarded', true)
}
