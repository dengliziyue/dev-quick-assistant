/**
 * Base64 / URL codec core. UTF-8 safe, no deps.
 * Unit tested in tests/core/base64.test.js
 */

const B64_CHARS = /^[A-Za-z0-9+/]*={0,2}$/

export function encodeBase64(text, { urlSafe = false } = {}) {
  const bytes = new TextEncoder().encode(String(text ?? ''))
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  let out = btoa(binary)
  if (urlSafe) out = out.replace(/\+/g, '-').replace(/\//g, '_')
  return { ok: true, result: out }
}

/**
 * Decode Base64 (lenient about whitespace, missing padding, URL-safe chars).
 * @returns {{ok:true, result:string} | {ok:false, error:{message, position?}}}
 */
export function decodeBase64(text) {
  let clean = String(text ?? '').replace(/\s+/g, '')
  if (!clean) return { ok: false, error: { message: 'empty' } }
  // normalize URL-safe alphabet
  clean = clean.replace(/-/g, '+').replace(/_/g, '/')
  // pad
  while (clean.length % 4 !== 0) clean += '='
  const bad = clean.search(/[^A-Za-z0-9+/=]/)
  if (bad !== -1) {
    return { ok: false, error: { message: 'invalid-char', position: bad, char: clean[bad] } }
  }
  const overPad = clean.length - clean.replace(/=+$/, '').length
  if (overPad > 2) {
    return { ok: false, error: { message: 'invalid-padding' } }
  }
  let binary
  try {
    binary = atob(clean)
  } catch (e) {
    return { ok: false, error: { message: 'invalid-data' } }
  }
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  try {
    const result = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return { ok: true, result }
  } catch {
    return { ok: false, error: { message: 'invalid-utf8' } }
  }
}

export function encodeUrl(text) {
  return { ok: true, result: encodeURIComponent(String(text ?? '')) }
}

export function decodeUrl(text) {
  try {
    return { ok: true, result: decodeURIComponent(String(text ?? '')) }
  } catch (e) {
    return { ok: false, error: { message: String((e && e.message) || e) } }
  }
}
