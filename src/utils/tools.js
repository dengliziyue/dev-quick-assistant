/**
 * Tool registry — single source of truth shared by popup / side panel / shortcuts.
 */
export const TOOLS = [
  { id: 'json', icon: 'json', nameKey: 'nav.json', descKey: 'nav.jsonDesc', hotkey: '1' },
  { id: 'diff', icon: 'diff', nameKey: 'nav.diff', descKey: 'nav.diffDesc', hotkey: '2' },
  { id: 'regex', icon: 'regex', nameKey: 'nav.regex', descKey: 'nav.regexDesc', hotkey: '3' },
  { id: 'time', icon: 'clock', nameKey: 'nav.time', descKey: 'nav.timeDesc', hotkey: '4' },
  { id: 'color', icon: 'droplet', nameKey: 'nav.color', descKey: 'nav.colorDesc', hotkey: '5' },
  { id: 'base64', icon: 'code', nameKey: 'nav.base64', descKey: 'nav.base64Desc', hotkey: '6' },
  { id: 'cookie', icon: 'cookie', nameKey: 'nav.cookie', descKey: 'nav.cookieDesc', hotkey: '7' },
  { id: 'request', icon: 'globe', nameKey: 'nav.request', descKey: 'nav.requestDesc', hotkey: '8' },
  { id: 'storage', icon: 'database', nameKey: 'nav.storage', descKey: 'nav.storageDesc', hotkey: '9' },
  { id: 'image', icon: 'photo', nameKey: 'nav.image', descKey: 'nav.imageDesc', hotkey: '0' }
]

export const TOOL_IDS = TOOLS.map((t) => t.id)

export function getTool(id) {
  return TOOLS.find((t) => t.id === id)
}

/** Async component loaders (code-split per tool). */
export function loadToolComponent(id) {
  switch (id) {
    case 'json': return import('../tools/JsonFormatter.vue')
    case 'diff': return import('../tools/JsonDiff.vue')
    case 'regex': return import('../tools/RegexTester.vue')
    case 'time': return import('../tools/TimestampConverter.vue')
    case 'color': return import('../tools/ColorConverter.vue')
    case 'base64': return import('../tools/Base64Tool.vue')
    case 'cookie': return import('../tools/CookieManager.vue')
    case 'request': return import('../tools/RequestCopier.vue')
    case 'storage': return import('../tools/StorageViewer.vue')
    case 'image': return import('../tools/ImageExtractor.vue')
    default: return null
  }
}
