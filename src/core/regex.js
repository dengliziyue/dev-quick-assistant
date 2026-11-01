/**
 * Regex testing core. Pure functions.
 * Guards: input length cap, match count cap, zero-length match advance,
 * full try/catch around compile & exec so the UI never crashes.
 * Unit tested in tests/core/regex.test.js
 */

export const MAX_TEST_LEN = 200_000
export const MAX_MATCHES = 10_000

const VALID_FLAGS = /^[dgimsuvy]*$/

export function compileRegex(pattern, flags = '') {
  if (typeof pattern !== 'string' || pattern.length === 0) {
    return { ok: false, error: { message: 'empty-pattern', stage: 'compile' } }
  }
  const fl = String(flags || '')
  if (!VALID_FLAGS.test(fl)) {
    return { ok: false, error: { message: `invalid-flags: ${fl}`, stage: 'compile' } }
  }
  try {
    return { ok: true, regex: new RegExp(pattern, fl) }
  } catch (e) {
    return { ok: false, error: { message: String((e && e.message) || e), stage: 'compile' } }
  }
}

/**
 * Run a regex over text and collect matches with groups.
 * @returns {{ok:true, matches:Array, count:number, truncated:boolean, timeMs:number, textUsed:string, textCut:boolean, groups:number}
 *          |{ok:false, error:{message, stage}}}
 */
export function runRegex(pattern, flags = '', text, opts = {}) {
  const maxMatches = opts.maxMatches ?? MAX_MATCHES
  const maxLen = opts.maxLen ?? MAX_TEST_LEN
  const compiled = compileRegex(pattern, flags)
  if (!compiled.ok) return compiled
  const regex = compiled.regex
  const textCut = typeof text === 'string' && text.length > maxLen
  const source = textCut ? text.slice(0, maxLen) : String(text ?? '')
  const matches = []
  const start = Date.now()
  let count = 0
  let truncated = false
  try {
    const global = regex.global
    regex.lastIndex = 0
    let m
    while ((m = regex.exec(source)) !== null) {
      count++
      if (matches.length < maxMatches) {
        matches.push({
          index: m.index,
          end: m.index + m[0].length,
          text: m[0],
          groups: m.slice(1),
          named: m.groups ? { ...m.groups } : null
        })
      } else {
        truncated = true
      }
      if (!global || m[0] === '') {
        // zero-length match: force progress for global regexes, stop otherwise
        if (global) regex.lastIndex++
        else break
      }
      if (count >= maxMatches) {
        if (regex.exec(source) !== null) truncated = true
        break
      }
      if (Date.now() - start > 2000) {
        truncated = true
        break
      }
    }
  } catch (e) {
    return { ok: false, error: { message: String((e && e.message) || e), stage: 'exec' } }
  }
  const groupCount = source && matches.length ? Math.max(...matches.map((x) => x.groups.length)) : groupCountOf(compiled.regex)
  return { ok: true, matches, count, truncated, timeMs: Date.now() - start, textUsed: source, textCut, groupCount }
}

function groupCountOf(regex) {
  try {
    const probe = new RegExp(regex.source + '|', regex.flags.replace('g', ''))
    const m = probe.exec('')
    return m ? m.length - 1 : 0
  } catch {
    return 0
  }
}

/**
 * String.replace with error containment (bad $ patterns throw).
 */
export function replaceRegex(pattern, flags, text, replacement) {
  const compiled = compileRegex(pattern, flags)
  if (!compiled.ok) return compiled
  try {
    return { ok: true, result: String(text ?? '').replace(compiled.regex, String(replacement ?? '')) }
  } catch (e) {
    return { ok: false, error: { message: String((e && e.message) || e), stage: 'replace' } }
  }
}

export const REGEX_PRESETS = [
  { id: 'email', pattern: '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}', flags: 'g' },
  { id: 'url', pattern: 'https?://[^\\s"\'<>]+', flags: 'g' },
  { id: 'ip', pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b', flags: 'g' },
  { id: 'date', pattern: '\\d{4}-\\d{2}-\\d{2}', flags: 'g' },
  { id: 'mobile', pattern: '1[3-9]\\d{9}', flags: 'g' },
  { id: 'hex', pattern: '#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b', flags: 'g' }
]

/** Escape user text for safe inclusion inside a RegExp constructor. */
export function escapeRegexLiteral(text) {
  return String(text ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
