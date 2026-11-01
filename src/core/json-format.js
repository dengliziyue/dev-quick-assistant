/**
 * JSON formatting core: parse / format / minify / sort / escape / stats.
 * All pure functions — unit tested in tests/core/json-format.test.js
 */

/** Above this size the UI disables syntax highlighting. */
export const HIGHLIGHT_LIMIT = 1024 * 1024
/** Above this size the UI shows a performance warning. */
export const SOFT_LIMIT = 2 * 1024 * 1024

/** Map a 0-based char position to {line, col} (both 1-based). */
export function positionToLineCol(text, position) {
  const pos = Math.max(0, Math.min(position ?? 0, text.length))
  const upto = text.slice(0, pos)
  const line = (upto.match(/\n/g) || []).length + 1
  const lastNl = upto.lastIndexOf('\n')
  const col = pos - lastNl
  return { line, col }
}

function extractPosition(message) {
  const m = /position\s+(\d+)/i.exec(message)
  return m ? parseInt(m[1], 10) : null
}

/**
 * Parse JSON with friendly error info.
 * @returns {{ok:true, data:any} | {ok:false, error:{message, line?, col?, position?}}}
 */
export function parseJson(text) {
  try {
    return { ok: true, data: JSON.parse(text) }
  } catch (e) {
    const message = String((e && e.message) || e)
    const position = extractPosition(message)
    const error = { message }
    if (position != null && typeof text === 'string') {
      const { line, col } = positionToLineCol(text, position)
      error.position = position
      error.line = line
      error.col = col
    }
    return { ok: false, error }
  }
}

function indentString(indent) {
  if (indent === 'tab' || indent === '\t') return '\t'
  const n = parseInt(indent, 10)
  return Number.isFinite(n) && n > 0 ? ' '.repeat(Math.min(n, 10)) : '  '
}

/**
 * Format / minify JSON text.
 * @returns {{ok:true, result:string, data:any} | {ok:false, error:object}}
 */
export function formatJson(text, indent = '2') {
  const parsed = parseJson(text)
  if (!parsed.ok) return parsed
  try {
    const result =
      indent === 'minify'
        ? JSON.stringify(parsed.data)
        : JSON.stringify(parsed.data, null, indentString(indent))
    return { ok: true, result, data: parsed.data }
  } catch (e) {
    return { ok: false, error: { message: String((e && e.message) || e) } }
  }
}

export function minifyJson(text) {
  return formatJson(text, 'minify')
}

/**
 * Recursively sort object keys (arrays keep order). Iterative queue to be
 * resilient against very deep structures.
 */
export function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  if (value && typeof value === 'object') {
    const out = {}
    for (const k of Object.keys(value).sort()) out[k] = sortKeysDeep(value[k])
    return out
  }
  return value
}

export function sortJsonKeys(text) {
  const parsed = parseJson(text)
  if (!parsed.ok) return parsed
  try {
    return { ok: true, result: JSON.stringify(sortKeysDeep(parsed.data), null, 2), data: parsed.data }
  } catch (e) {
    return { ok: false, error: { message: String((e && e.message) || e) } }
  }
}

/** Turn arbitrary text into a JSON string literal. */
export function escapeJsonString(text) {
  return { ok: true, result: JSON.stringify(String(text ?? '')) }
}

/**
 * Reverse of escapeJsonString. Accepts a quoted literal; when quotes are
 * missing the whole input is treated as the literal content (with a note).
 */
export function unescapeJsonString(text) {
  const raw = String(text ?? '')
  const trimmed = raw.trim()
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    const parsed = parseJson(trimmed)
    if (!parsed.ok) return parsed
    return { ok: true, result: parsed.data }
  }
  const wrapped = parseJson('"' + raw.replace(/\\(?=["\\]|$)/g, '\\\\').replace(/"/g, '\\"') + '"')
  if (!wrapped.ok) {
    return { ok: false, error: { message: wrapped.error.message } }
  }
  return { ok: true, result: wrapped.data, note: 'unquoted' }
}

/**
 * Stats for display: bytes (UTF-8), chars, lines, max nesting depth.
 */
export function jsonStats(text) {
  const chars = text.length
  let bytes
  try {
    bytes = new TextEncoder().encode(text).length
  } catch {
    bytes = chars
  }
  const lines = text ? (text.match(/\n/g) || []).length + 1 : 0
  let depth = 0
  const parsed = parseJson(text)
  if (parsed.ok) {
    try {
      depth = measureDepth(parsed.data)
    } catch {
      depth = -1
    }
  }
  return { bytes, chars, lines, depth }
}

function measureDepth(root) {
  if (!root || typeof root !== 'object') return 0
  let max = 0
  const stack = [[root, 1]]
  while (stack.length) {
    const [node, d] = stack.pop()
    if (d > max) max = d
    if (Array.isArray(node)) {
      for (const child of node) {
        if (child && typeof child === 'object') stack.push([child, d + 1])
      }
    } else if (node && typeof node === 'object') {
      for (const k of Object.keys(node)) {
        const child = node[k]
        if (child && typeof child === 'object') stack.push([child, d + 1])
      }
    }
  }
  return max
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;' }
function esc(s) {
  return s.replace(/[&<>]/g, (c) => HTML_ESCAPES[c])
}

/**
 * Highlight a formatted JSON string into safe HTML.
 * Only called for inputs below HIGHLIGHT_LIMIT.
 */
export function highlightJson(formatted) {
  let out = ''
  let i = 0
  const n = formatted.length
  const push = (cls, content) => {
    out += cls ? `<span class="${cls}">${esc(content)}</span>` : esc(content)
  }
  while (i < n) {
    const c = formatted[i]
    if (c === '"') {
      let j = i + 1
      while (j < n) {
        if (formatted[j] === '\\') j += 2
        else if (formatted[j] === '"') {
          j++
          break
        } else j++
      }
      const literal = formatted.slice(i, j)
      // key if next non-space char is ':'
      let k = j
      while (k < n && (formatted[k] === ' ' || formatted[k] === '\t')) k++
      push(formatted[k] === ':' ? 'tok-key' : 'tok-str', literal)
      i = j
      continue
    }
    if (c === '-' || (c >= '0' && c <= '9')) {
      const m = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(formatted.slice(i))
      const literal = m ? m[0] : c
      push('tok-num', literal)
      i += literal.length
      continue
    }
    const rest = formatted.slice(i, i + 5)
    if (rest.startsWith('true') || rest.startsWith('false')) {
      push('tok-bool', rest.startsWith('true') ? 'true' : 'false')
      i += rest.startsWith('true') ? 4 : 5
      continue
    }
    if (rest.startsWith('null')) {
      push('tok-null', 'null')
      i += 4
      continue
    }
    push('', c)
    i++
  }
  return out
}
