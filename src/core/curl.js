/**
 * Request -> cURL / fetch converters. Pure functions.
 * Input record: { method, url, headers:[[k,v]...], body?:string }
 * Unit tested in tests/core/curl.test.js
 */

function normalizeHeaders(headers) {
  if (!headers) return []
  if (Array.isArray(headers)) return headers.filter((h) => Array.isArray(h) && h[0])
  return Object.entries(headers)
}

function shellQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`
}

/**
 * Generate a bash cURL command.
 * @param {object} req {method, url, headers, body}
 * @param {object} opts {multiline:boolean=true}
 */
export function toCurl(req, { multiline = true } = {}) {
  const method = (req.method || 'GET').toUpperCase()
  const headers = normalizeHeaders(req.headers)
  const hasBody = req.body != null && req.body !== ''
  const segments = ['curl', shellQuote(req.url || '')]
  if (method && method !== 'GET') segments.push('-X ' + method)
  for (const [k, v] of headers) {
    segments.push('-H ' + shellQuote(v == null || v === '' ? `${k};` : `${k}: ${v}`))
  }
  if (hasBody) segments.push('--data-raw ' + shellQuote(req.body))
  const sep = multiline ? ' \\\n  ' : ' '
  let out = segments[0]
  for (let i = 1; i < segments.length; i++) {
    out += (i === 1 ? ' ' : sep) + segments[i]
  }
  return out
}

/**
 * Generate a fetch() snippet (top-level await, console friendly).
 */
export function toFetch(req) {
  const method = (req.method || 'GET').toUpperCase()
  const headers = normalizeHeaders(req.headers)
  const hasBody = req.body != null && req.body !== ''
  const headerObj = {}
  for (const [k, v] of headers) headerObj[k] = v == null ? '' : String(v)

  const lines = []
  lines.push(`const res = await fetch(${JSON.stringify(req.url || '')}, {`)
  if (method !== 'GET' || hasBody) lines.push(`  method: ${JSON.stringify(method)},`)
  if (headers.length) {
    lines.push('  headers: ' + JSON.stringify(headerObj) + ',')
  }
  if (hasBody) {
    lines.push(`  body: ${JSON.stringify(String(req.body))},`)
  }
  lines.push('});')
  return lines.join('\n')
}

/**
 * Pick the transferable fields from a captured request record.
 */
export function recordToTransferable(record) {
  if (!record) return { method: 'GET', url: '', headers: [], body: '' }
  return {
    method: record.method || 'GET',
    url: record.url || '',
    headers: Array.isArray(record.reqHeaders)
      ? record.reqHeaders.map(([k, v]) => [k, v == null ? '' : String(v)])
      : [],
    body: typeof record.body === 'string' ? record.body : ''
  }
}
