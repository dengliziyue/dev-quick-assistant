/**
 * Dev-only chrome.* API mock so the whole UI can run in a plain browser
 * tab via `npm run dev` + /preview.html (no extension loading required).
 * The mock exercises the REAL page-collectors against this document.
 * Never imported by production pages.
 */

const DEMO_URL = 'https://example.com/demo-page'

export const MOCK_REQUESTS = [
  {
    id: 6, ts: Date.now() - 4_000, kind: 'fetch', method: 'GET',
    url: 'https://api.example.com/v2/users?page=2&size=50',
    status: 200, statusText: 'OK', duration: 143.2,
    reqHeaders: [['accept', 'application/json'], ['authorization', 'Bearer eyJhbGci...']],
    resHeaders: [['content-type', 'application/json'], ['x-request-id', 'req-777']],
    body: '', error: ''
  },
  {
    id: 5, ts: Date.now() - 9_000, kind: 'xhr', method: 'POST',
    url: 'https://api.example.com/v2/orders',
    status: 201, statusText: 'Created', duration: 88.4,
    reqHeaders: [['content-type', 'application/json'], ['x-csrf-token', 'tok123']],
    resHeaders: [['content-type', 'application/json'], ['location', '/v2/orders/42']],
    body: '{"sku":"DQA-001","qty":2,"price":199.00}', error: ''
  },
  {
    id: 4, ts: Date.now() - 15_000, kind: 'fetch', method: 'PUT',
    url: "https://api.example.com/v2/users/42/settings?it's=ok",
    status: 204, statusText: 'No Content', duration: 61.0,
    reqHeaders: [['content-type', 'application/merge-patch+json']],
    resHeaders: [], body: '{"theme":"dark"}', error: ''
  },
  {
    id: 3, ts: Date.now() - 22_000, kind: 'xhr', method: 'GET',
    url: 'https://cdn.example.com/assets/app.9f2c1d.js',
    status: 200, statusText: 'OK', duration: 310.7,
    reqHeaders: [], resHeaders: [['content-type', 'text/javascript']], body: '', error: ''
  },
  {
    id: 2, ts: Date.now() - 30_000, kind: 'fetch', method: 'DELETE',
    url: 'https://api.example.com/v2/caches/user-42',
    status: 0, statusText: '', duration: 5021.0,
    reqHeaders: [], resHeaders: [], body: '', error: 'Failed to fetch'
  }
]

export const MOCK_COOKIES = [
  { name: 'session_id', value: 's%3AAb3xY9kQ.stage', domain: '.example.com', path: '/', secure: true, httpOnly: true, sameSite: 'lax', expirationDate: Math.floor(Date.now() / 1000) + 86400 * 7 },
  { name: 'theme', value: 'dark', domain: 'example.com', path: '/', secure: false, httpOnly: false, sameSite: 'unspecified' },
  { name: 'track_uid', value: 'u-1203948576', domain: '.example.com', path: '/', secure: true, httpOnly: false, sameSite: 'none', expirationDate: Math.floor(Date.now() / 1000) + 86400 * 180 },
  { name: 'locale', value: 'zh-CN', domain: 'sub.example.com', path: '/app', secure: false, httpOnly: false, sameSite: 'unspecified' }
]

export function installChromeMock() {
  const existing = typeof globalThis.chrome !== 'undefined' && globalThis.chrome?.runtime?.id
  if (existing && !globalThis.__DQA_FORCE_MOCK__) return false

  const emit = (type, detail) =>
    window.dispatchEvent(new CustomEvent('dqa-preview', { detail: { type, ...detail } }))

  const listeners = new Set()
  globalThis.chrome = {
    runtime: {
      id: 'dqa-preview-mock',
      getURL: (p) => (p.startsWith('/') ? p : '/' + p),
      getManifest: () => ({ version: '1.0.0-mock' }),
      onMessage: { addListener: (fn) => listeners.add(fn) },
      sendMessage: async (msg) => ({ ok: false, code: 'NO_HOOK' })
    },
    storage: {
      sync: {
        async get(keys) {
          const keyList = Array.isArray(keys) ? keys : Object.keys(keys)
          const defaults = Array.isArray(keys) ? {} : keys
          const out = {}
          for (const k of keyList) {
            const raw = localStorage.getItem('dqa:' + k)
            if (raw != null) {
              try { out[k] = JSON.parse(raw) } catch { out[k] = raw }
            } else if (k in defaults) out[k] = defaults[k]
          }
          return out
        },
        async set(obj) {
          for (const [k, v] of Object.entries(obj)) localStorage.setItem('dqa:' + k, JSON.stringify(v))
        },
        async clear() {
          Object.keys(localStorage).filter((k) => k.startsWith('dqa:')).forEach((k) => localStorage.removeItem(k))
        }
      },
      session: {
        async get(keys) {
          const keyList = Array.isArray(keys) ? keys : Object.keys(keys)
          const out = {}
          for (const k of keyList) {
            const raw = sessionStorage.getItem('dqa:' + k)
            if (raw != null) out[k] = JSON.parse(raw)
          }
          return out
        },
        async set(obj) {
          for (const [k, v] of Object.entries(obj)) sessionStorage.setItem('dqa:' + k, JSON.stringify(v))
        },
        async remove(keys) {
          for (const k of Array.isArray(keys) ? keys : [keys]) sessionStorage.removeItem('dqa:' + k)
        }
      }
    },
    tabs: {
      query: async () => [{ id: 1, url: DEMO_URL, title: 'Demo Page — Example' }],
      create: async ({ url }) => {
        const tool = new URL(url, 'http://x').searchParams.get('tool')
        emit('openTab', { tool })
        return { id: 99 }
      },
      sendMessage(tabId, msg, cb) {
        setTimeout(() => {
          cb?.({
            ok: true,
            requests: MOCK_REQUESTS,
            pageUrl: DEMO_URL
          })
        }, 120)
      }
    },
    scripting: {
      async executeScript({ func, args }) {
        // Run the very same collector functions against this document.
        return [{ result: func(...(args || [])) }]
      }
    },
    cookies: {
      getAll: async () => JSON.parse(JSON.stringify(MOCK_COOKIES)),
      set: async (params) => {
        const idx = MOCK_COOKIES.findIndex((c) => c.name === params.name)
        const cookie = {
          name: params.name,
          value: params.value,
          domain: params.domain || new URL(params.url).hostname,
          path: params.path || '/',
          secure: !!params.secure,
          httpOnly: !!params.httpOnly,
          sameSite: params.sameSite || 'unspecified',
          expirationDate: params.expirationDate ?? null
        }
        if (idx >= 0) MOCK_COOKIES[idx] = cookie
        else MOCK_COOKIES.push(cookie)
        return cookie
      },
      remove: async (params) => {
        const idx = MOCK_COOKIES.findIndex((c) => c.name === params.name)
        if (idx >= 0) MOCK_COOKIES.splice(idx, 1)
      }
    },
    downloads: {
      download: async (opts) => {
        console.info('[dqa mock] download:', opts.filename, '<-', String(opts.url).slice(0, 80))
        return 1
      }
    },
    sidePanel: {
      open: async ({ tabId }) => emit('openPanel', { tabId }),
      setPanelBehavior: async () => {}
    },
    commands: { onCommand: { addListener: () => {} } }
  }
  return true
}
