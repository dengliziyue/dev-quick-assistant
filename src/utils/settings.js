/**
 * Reactive settings store, persisted to chrome.storage.sync (or localStorage in dev).
 * Theme resolution: 'auto' follows prefers-color-scheme.
 */
import { reactive, watch } from 'vue'
import { syncStore } from './storage-area'

export const DEFAULT_SETTINGS = {
  theme: 'auto', // 'auto' | 'light' | 'dark'
  locale: 'auto', // 'auto' | 'zh' | 'en'
  jsonIndent: '2', // '2' | '4' | 'tab'
  reqBufferSize: 200, // captured request ring buffer size
  imageThumbs: true
}

export const settings = reactive({ ...DEFAULT_SETTINGS, _loaded: false })

let media = null
let persistTimer = null

function schedulePersist() {
  if (!settings._loaded) return
  clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    const { _loaded, ...data } = settings
    syncStore.set(data).catch(() => {})
  }, 250)
}

/** Applies theme immediately on any change (toggle, init, system switch). */
watch(
  settings,
  () => {
    schedulePersist()
    applyTheme()
  },
  { deep: true }
)

export async function initSettings() {
  try {
    const stored = await syncStore.get({ ...DEFAULT_SETTINGS })
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
      if (stored[k] != null) settings[k] = stored[k]
    }
  } catch {
    /* storage unavailable — keep defaults */
  }
  settings._loaded = true
  try {
    media = globalThis.matchMedia?.('(prefers-color-scheme: dark)')
    media?.addEventListener?.('change', () => {
      if (settings.theme === 'auto') applyTheme()
    })
  } catch {
    /* matchMedia unavailable */
  }
  return settings
}

export function resolvedTheme() {
  if (settings.theme === 'light' || settings.theme === 'dark') return settings.theme
  try {
    return globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function applyTheme() {
  const el = typeof document !== 'undefined' ? document.documentElement : null
  if (el) el.dataset.theme = resolvedTheme()
}

export async function resetSettings() {
  Object.assign(settings, DEFAULT_SETTINGS)
  await syncStore.set({ ...DEFAULT_SETTINGS }).catch(() => {})
  applyTheme()
}
