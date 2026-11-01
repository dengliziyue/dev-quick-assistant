/**
 * Standalone functions injected into web pages via chrome.scripting.
 * IMPORTANT: these run serialized inside the page — they must be fully
 * self-contained (no imports, no closures over module state) and must
 * never throw. They run in the ISOLATED world, which shares DOM and
 * Web Storage with the page.
 */

/**
 * Collect localStorage/sessionStorage entries.
 * @returns {{items:Array, error?:string}}
 */
export function collectPageStorage(kind, maxPreview = 2048, maxItems = 5000) {
  try {
    const store = kind === 'session' ? sessionStorage : localStorage
    const items = []
    for (let i = 0; i < store.length && items.length < maxItems; i++) {
      const key = store.key(i)
      if (key == null) continue
      let value = ''
      try {
        value = store.getItem(key) ?? ''
      } catch {
        value = ''
      }
      const truncated = value.length > maxPreview
      items.push({
        key,
        value,
        preview: truncated ? value.slice(0, maxPreview) : value,
        size: key.length + value.length,
        truncated
      })
    }
    return { items, total: store.length }
  } catch (e) {
    return { items: [], error: String((e && e.message) || e) }
  }
}

/**
 * Write a key back. Quota errors are reported, not thrown.
 */
export function writePageStorage(kind, key, value) {
  try {
    const store = kind === 'session' ? sessionStorage : localStorage
    store.setItem(key, value)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) }
  }
}

export function removePageStorageKey(kind, key) {
  try {
    const store = kind === 'session' ? sessionStorage : localStorage
    store.removeItem(key)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) }
  }
}

export function clearPageStorage(kind) {
  try {
    const store = kind === 'session' ? sessionStorage : localStorage
    store.clear()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) }
  }
}

/**
 * Collect image URLs from the document: <img>, CSS backgrounds, site icons.
 * Deduplicated, absolute URLs, capped for safety.
 */
export function collectPageImages(opts) {
  const max = (opts && opts.max) || 3000
  const includeCss = !opts || opts.includeCss !== false
  const includeIcons = !opts || opts.includeIcons !== false
  const seen = new Set()
  const items = []
  let saturated = false

  function typeOf(url) {
    try {
      const path = url.split(/[?#]/)[0]
      const m = path.match(/\.([a-z0-9]{1,5})$/i)
      if (!m) return 'other'
      const ext = m[1].toLowerCase()
      if (ext === 'jpg' || ext === 'jpeg') return 'jpg'
      return ext
    } catch {
      return 'other'
    }
  }

  function push(raw, meta) {
    if (saturated || !raw) return
    try {
      if (typeof raw !== 'string' || raw.length > 200000) return
      if (raw.startsWith('javascript:')) return
      const abs = raw.startsWith('data:') || raw.startsWith('blob:') ? raw : new URL(raw, location.href).href
      if (seen.has(abs)) return
      seen.add(abs)
      if (items.length >= max) {
        saturated = true
        return
      }
      items.push({ url: abs, type: abs.startsWith('data:') ? 'data' : typeOf(abs), ...meta })
    } catch {
      /* ignore malformed URL */
    }
  }

  try {
    for (const img of document.querySelectorAll('img')) {
      try {
        const src = img.currentSrc || img.getAttribute('src') || ''
        if (!src) continue
        push(src, {
          w: img.naturalWidth || 0,
          h: img.naturalHeight || 0,
          alt: img.alt || '',
          source: 'img'
        })
      } catch {
        /* skip broken node */
      }
    }
  } catch {
    /* ignore */
  }

  if (includeCss) {
    try {
      const nodes = document.querySelectorAll('*')
      let scanned = 0
      const re = /url\((['"]?)([^'")]+)\1\)/g
      for (const el of nodes) {
        if (++scanned > 6000 || saturated) break
        let bg = ''
        try {
          bg = getComputedStyle(el).backgroundImage
        } catch {
          continue
        }
        if (!bg || bg === 'none') continue
        let m
        while ((m = re.exec(bg)) !== null) {
          push(m[2].trim(), { w: 0, h: 0, alt: '', source: 'css' })
          if (saturated) break
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (includeIcons) {
    try {
      const links = document.querySelectorAll('link[rel*="icon"]')
      for (const link of links) {
        const href = link.getAttribute('href') || ''
        if (!href) continue
        let w = 0
        let h = 0
        const sizes = link.getAttribute('sizes') || ''
        const sm = sizes.match(/(\d+)x(\d+)/i)
        if (sm) {
          w = parseInt(sm[1], 10)
          h = parseInt(sm[2], 10)
        }
        push(href, { w, h, alt: '', source: 'icon' })
      }
    } catch {
      /* ignore */
    }
  }

  return { items, docUrl: location.href, saturated }
}
