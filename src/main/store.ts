import Store from 'electron-store'
import type { HistoryEntry } from '../shared/types'

/** Most recent saves kept; older entries fall off the end. */
const HISTORY_LIMIT = 100

type ConfigSchema = {
  lastSaveFolder?: string
  geminiApiKey?: string
  onboarded?: boolean
  lastYtdlpCheck?: number
  history?: HistoryEntry[]
}

// The Gemini key never leaves this machine: Gemini calls happen in the
// main process, and the renderer only reads it back for the settings
// reveal toggle.
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

export function getHistory(): HistoryEntry[] {
  return store.get('history', [])
}

/** Prepend a save so the newest is first, capped at HISTORY_LIMIT. */
export function addHistoryEntry(entry: HistoryEntry): void {
  const next = [entry, ...getHistory()].slice(0, HISTORY_LIMIT)
  store.set('history', next)
}

export function deleteHistoryEntry(id: string): void {
  store.set(
    'history',
    getHistory().filter((entry) => entry.id !== id)
  )
}

export function clearHistory(): void {
  store.set('history', [])
}
