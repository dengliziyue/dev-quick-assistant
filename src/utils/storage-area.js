/**
 * Storage abstraction: chrome.storage.sync when available (extension),
 * localStorage-backed fallback (dev preview / unit tests).
 */
const LS_PREFIX = 'dqa:'

function browserStore() {
  return typeof chrome !== 'undefined' && chrome?.storage?.sync
}

function lsGet(keys) {
  const keyList = Array.isArray(keys) ? keys : Object.keys(keys)
  const defaults = Array.isArray(keys) ? {} : keys
  const out = {}
  for (const k of keyList) {
    const raw = globalThis.localStorage?.getItem(LS_PREFIX + k)
    if (raw != null) {
      try {
        out[k] = JSON.parse(raw)
      } catch {
        out[k] = raw
      }
    } else if (k in defaults) {
      out[k] = defaults[k]
    }
  }
  return out
}

function lsSet(obj) {
  for (const [k, v] of Object.entries(obj)) {
    globalThis.localStorage?.setItem(LS_PREFIX + k, JSON.stringify(v))
  }
}

export const syncStore = {
  async get(keys) {
    if (browserStore()) return chrome.storage.sync.get(keys)
    return lsGet(keys)
  },
  async set(obj) {
    if (browserStore()) return chrome.storage.sync.set(obj)
    return lsSet(obj)
  },
  async clear() {
    if (browserStore()) return chrome.storage.sync.clear()
    const ls = globalThis.localStorage
    if (!ls) return
    Object.keys(ls)
      .filter((k) => k.startsWith(LS_PREFIX))
      .forEach((k) => ls.removeItem(k))
  }
}

/** chrome.storage.session with sessionStorage fallback (popup -> sidepanel handoff). */
export const sessionStore = {
  async get(keys) {
    if (typeof chrome !== 'undefined' && chrome?.storage?.session) {
      return chrome.storage.session.get(keys)
    }
    const keyList = Array.isArray(keys) ? keys : Object.keys(keys)
    const out = {}
    for (const k of keyList) {
      const raw = globalThis.sessionStorage?.getItem(LS_PREFIX + k)
      if (raw != null) out[k] = JSON.parse(raw)
    }
    return out
  },
  async set(obj) {
    if (typeof chrome !== 'undefined' && chrome?.storage?.session) {
      return chrome.storage.session.set(obj)
    }
    for (const [k, v] of Object.entries(obj)) {
      globalThis.sessionStorage?.setItem(LS_PREFIX + k, JSON.stringify(v))
    }
  },
  async remove(keys) {
    const keyList = Array.isArray(keys) ? keys : [keys]
    if (typeof chrome !== 'undefined' && chrome?.storage?.session) {
      return chrome.storage.session.remove(keyList)
    }
    for (const k of keyList) globalThis.sessionStorage?.removeItem(LS_PREFIX + k)
  }
}
