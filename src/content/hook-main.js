/**
 * MAIN-world request capture hook (runs at document_start, before page scripts).
 * Hooks window.fetch and XMLHttpRequest, keeps a ring buffer in page memory.
 *
 * Privacy: records live only in this tab's memory; nothing is persisted or
 * transmitted anywhere. The ISOLATED-world bridge (bridge.js) may read the
 * buffer on explicit user request via window CustomEvents.
 *
 * Protocol (with the bridge):
 *   window 'DQA_REQ_QUERY' {nonce}  ->  window 'DQA_REQ_DATA' {nonce, payload}
 *
 * This file is dependency-free IIFE — it must never throw into the page.
 */
;(function () {
  'use strict'
  if (window.__DQA_HOOKED__) return
  try {
    Object.defineProperty(window, '__DQA_HOOKED__', { value: true, enumerable: false })
  } catch {
    window.__DQA_HOOKED__ = true
  }

  var MAX_RECORDS = 200
  var MAX_BODY = 50_000
  var buffer = []
  var seq = 0

  function now() {
    try {
      return performance.now()
    } catch {
      return Date.now()
    }
  }

  function truncated(s) {
    if (typeof s !== 'string') return ''
    return s.length > MAX_BODY ? s.slice(0, MAX_BODY) : s
  }

  function push(record) {
    try {
      record.id = ++seq
      record.ts = Date.now()
      buffer.push(record)
      if (buffer.length > MAX_RECORDS) buffer.splice(0, buffer.length - MAX_RECORDS)
    } catch {
      /* never break the page */
    }
  }

  function skipUrl(url) {
    return !url || /^(chrome|edge|about|devtools|moz)-?(extension)?:/i.test(url)
  }

  function headerEntries(headers) {
    try {
      if (!headers) return []
      if (typeof Headers !== 'undefined' && headers instanceof Headers) {
        var out = []
        headers.forEach(function (v, k) {
          out.push([k, v])
        })
        return out
      }
      if (Array.isArray(headers)) return headers.map(function (h) { return [String(h[0]), String(h[1])] })
      return Object.keys(headers).map(function (k) { return [k, String(headers[k])] })
    } catch {
      return []
    }
  }

  function bodyToText(body) {
    try {
      if (body == null) return ''
      if (typeof body === 'string') return truncated(body)
      if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
        return truncated(body.toString())
      }
      if (typeof FormData !== 'undefined' && body instanceof FormData) {
        var obj = {}
        var it = body.entries()
        var step
        while (!(step = it.next()).done) {
          var k = step.value[0]
          var v = step.value[1]
          obj[k] = v instanceof File ? '[File ' + v.name + ' ' + v.size + 'B]' : String(v)
        }
        return truncated(JSON.stringify(obj))
      }
      if (typeof Blob !== 'undefined' && body instanceof Blob) {
        return '[Blob ' + body.size + 'B ' + (body.type || '') + ']'
      }
      if (body instanceof ArrayBuffer) return '[ArrayBuffer ' + body.byteLength + 'B]'
      if (ArrayBuffer.isView && ArrayBuffer.isView(body)) return '[TypedArray ' + body.byteLength + 'B]'
      if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) {
        return '[ReadableStream]'
      }
      var s = String(body)
      return truncated(s)
    } catch {
      return '[unserializable body]'
    }
  }

  function resolveUrl(url) {
    try {
      return new URL(url, location.href).href
    } catch {
      return String(url)
    }
  }

  // ---------------- fetch hook ----------------
  var origFetch = window.fetch
  if (typeof origFetch === 'function') {
    window.fetch = function (input, init) {
      var started = now()
      var record = null
      try {
        var method = 'GET'
        var url = ''
        var headers = []
        var body = ''
        var req = null

        if (typeof Request !== 'undefined' && input instanceof Request) {
          req = input
          method = req.method || 'GET'
          url = req.url
          headers = headerEntries(req.headers)
          if (init && init.body) body = bodyToText(init.body)
          else if (!req.bodyUsed && req.method !== 'GET' && req.method !== 'HEAD') {
            try {
              req.clone().text().then(function (t) {
                record.body = truncated(t)
              }).catch(function () {})
            } catch {}
          }
        } else {
          url = resolveUrl(typeof input === 'string' ? input : String(input))
        }
        if (init) {
          if (init.method) method = init.method
          if (init.headers) headers = headerEntries(init.headers)
          if (init.body && !body) body = bodyToText(init.body)
        }
        if (!url) url = resolveUrl(String(input))

        record = {
          kind: 'fetch',
          method: String(method).toUpperCase(),
          url: url,
          reqHeaders: headers,
          body: truncated(body),
          status: 0,
          statusText: '',
          resHeaders: [],
          duration: 0,
          error: ''
        }
        if (skipUrl(url)) record = null
      } catch {
        record = null
      }

      var promise = origFetch.apply(this, arguments)
      if (record) {
        promise.then(
          function (res) {
            try {
              record.status = res.status
              record.statusText = res.statusText || ''
              record.resHeaders = headerEntries(res.headers)
              record.duration = now() - started
              push(record)
            } catch {}
          },
          function (err) {
            try {
              record.error = String(err && err.message) || 'network error'
              record.duration = now() - started
              push(record)
            } catch {}
          }
        )
      }
      return promise
    }
    try {
      Object.defineProperty(window.fetch, 'name', { value: 'fetch' })
    } catch {}
  }

  // ---------------- XHR hook ----------------
  function patchXhr() {
    var Xhr = window.XMLHttpRequest
    if (!Xhr || !Xhr.prototype) return
    var proto = Xhr.prototype
    var origOpen = proto.open
    var origSend = proto.send
    var origSetHeader = proto.setRequestHeader

    proto.open = function (method, url) {
      var state = { method: String(method || 'GET').toUpperCase(), url: resolveUrl(url), headers: [] }
      try {
        Object.defineProperty(this, '__dqa_state', { value: state, configurable: true, writable: true })
      } catch {
        this.__dqa_state = state
      }
      return origOpen.apply(this, arguments)
    }

    proto.setRequestHeader = function (name, value) {
      try {
        if (this.__dqa_state) this.__dqa_state.headers.push([String(name), String(value)])
      } catch {}
      return origSetHeader.apply(this, arguments)
    }

    proto.send = function (body) {
      var start = now()
      var xhr = this
      var record = null
      try {
        var st = xhr.__dqa_state || { method: 'GET', url: '', headers: [] }
        if (!skipUrl(st.url)) {
          record = {
            kind: 'xhr',
            method: st.method,
            url: st.url,
            reqHeaders: st.headers,
            body: bodyToText(body),
            status: 0,
            statusText: '',
            resHeaders: [],
            duration: 0,
            error: ''
          }
        }
      } catch {
        record = null
      }

      function finalize() {
        try {
          if (!record) return
          record.status = xhr.status || 0
          record.statusText = xhr.statusText || ''
          var raw = xhr.getAllResponseHeaders ? xhr.getAllResponseHeaders() : ''
          record.resHeaders = raw
            ? raw
                .trim()
                .split(/[\r\n]+/)
                .map(function (line) {
                  var idx = line.indexOf(':')
                  return idx > 0 ? [line.slice(0, idx).trim(), line.slice(idx + 1).trim()] : null
                })
                .filter(Boolean)
            : []
          record.duration = now() - start
          push(record)
          record = null
        } catch {
          record = null
        }
      }

      try {
        xhr.addEventListener('loadend', finalize)
      } catch {
        var orig = xhr.onreadystatechange
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4) finalize()
          if (orig) orig.apply(this, arguments)
        }
      }
      return origSend.apply(this, arguments)
    }
  }
  try {
    patchXhr()
  } catch {}

  // ---------------- bridge protocol ----------------
  window.addEventListener('DQA_REQ_QUERY', function (ev) {
    try {
      var nonce = ev && ev.detail && ev.detail.nonce
      window.dispatchEvent(
        new CustomEvent('DQA_REQ_DATA', {
          detail: {
            nonce: nonce,
            payload: {
              requests: buffer.slice(-MAX_RECORDS).map(function (r) {
                return {
                  id: r.id,
                  ts: r.ts,
                  kind: r.kind,
                  method: r.method,
                  url: r.url,
                  status: r.status,
                  statusText: r.statusText,
                  reqHeaders: r.reqHeaders,
                  resHeaders: r.resHeaders,
                  body: r.body,
                  duration: r.duration,
                  error: r.error
                }
              }),
              pageUrl: location.href,
              hooked: true,
              maxRecords: MAX_RECORDS
            }
          }
        })
      )
    } catch {}
  })
})()
