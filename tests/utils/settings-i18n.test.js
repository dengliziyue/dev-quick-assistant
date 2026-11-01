// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { settings, DEFAULT_SETTINGS, resolvedTheme, applyTheme } from '../../src/utils/settings'
import { t, MESSAGES } from '../../src/utils/i18n'
import { syncStore, sessionStore } from '../../src/utils/storage-area'
import { TOOLS, getTool, TOOL_IDS } from '../../src/utils/tools'

describe('settings store (localStorage fallback)', () => {
  beforeEach(async () => {
    localStorage.clear()
    Object.assign(settings, DEFAULT_SETTINGS)
    await syncStore.set({ theme: 'dark', locale: 'en' })
  })

  it('persisted values are visible through syncStore', async () => {
    const got = await syncStore.get({ theme: 'auto' })
    expect(got.theme).toBe('dark')
  })

  it('resolvedTheme honors explicit preference', () => {
    settings.theme = 'dark'
    expect(resolvedTheme()).toBe('dark')
    settings.theme = 'light'
    expect(resolvedTheme()).toBe('light')
    settings.theme = 'auto'
    // happy-dom defaults to light scheme
    expect(['light', 'dark']).toContain(resolvedTheme())
  })

  it('applyTheme writes data-theme attribute', () => {
    settings.theme = 'dark'
    applyTheme()
    expect(document.documentElement.dataset.theme).toBe('dark')
    settings.theme = 'light'
    applyTheme()
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('resetSettings restores defaults', async () => {
    settings.theme = 'dark'
    settings.jsonIndent = '4'
    const { resetSettings } = await import('../../src/utils/settings')
    await resetSettings()
    expect(settings.theme).toBe(DEFAULT_SETTINGS.theme)
    expect(settings.jsonIndent).toBe(DEFAULT_SETTINGS.jsonIndent)
  })
})

describe('i18n', () => {
  it('translates with interpolation', () => {
    settings.locale = 'zh'
    expect(t('common.total', { n: 3 })).toBe('共 3 项')
    settings.locale = 'en'
    expect(t('common.total', { n: 3 })).toBe('3 items')
  })

  it('falls back between locales and to the key', () => {
    settings.locale = 'en'
    expect(t('nav.json')).toBe('JSON Formatter')
    settings.locale = 'zh'
    expect(t('nav.json')).toBe('JSON 格式化')
    expect(t('definitely.not.a.key')).toBe('definitely.not.a.key')
  })

  it('auto resolves zh/en from navigator.language', () => {
    settings.locale = 'auto'
    const expectZh = (navigator.language || '').toLowerCase().startsWith('zh')
    expect(t('common.copy')).toBe(expectZh ? '复制' : 'Copy')
  })

  it('dictionaries are key-aligned between zh and en', () => {
    function keysOf(obj, prefix = '') {
      return Object.entries(obj).flatMap(([k, v]) =>
        typeof v === 'object' ? keysOf(v, `${prefix}${k}.`) : [`${prefix}${k}`]
      )
    }
    const zh = keysOf(MESSAGES.zh).sort()
    const en = keysOf(MESSAGES.en).sort()
    expect(en).toEqual(zh)
  })
})

describe('storage-area session store', () => {
  it('set/get/remove on sessionStorage fallback', async () => {
    await sessionStore.set({ pendingTool: 'json' })
    expect((await sessionStore.get(['pendingTool'])).pendingTool).toBe('json')
    await sessionStore.remove('pendingTool')
    expect((await sessionStore.get(['pendingTool'])).pendingTool).toBeUndefined()
  })
})

describe('tool registry', () => {
  it('has 10 unique tools with hotkeys', () => {
    expect(TOOLS).toHaveLength(10)
    expect(new Set(TOOLS.map((x) => x.id)).size).toBe(10)
    expect(new Set(TOOLS.map((x) => x.hotkey)).size).toBe(10)
    expect(TOOL_IDS).toContain('json')
  })

  it('getTool finds by id', () => {
    expect(getTool('regex').nameKey).toBe('nav.regex')
    expect(getTool('nope')).toBeUndefined()
  })
})
