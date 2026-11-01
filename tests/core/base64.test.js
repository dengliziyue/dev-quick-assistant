import { describe, it, expect } from 'vitest'
import { encodeBase64, decodeBase64, encodeUrl, decodeUrl } from '../../src/core/base64'

describe('encodeBase64', () => {
  it('encodes ASCII correctly', () => {
    expect(encodeBase64('hello').result).toBe('aGVsbG8=')
    expect(encodeBase64('').result).toBe('')
    expect(encodeBase64('f').result).toBe('Zg==')
    expect(encodeBase64('fo').result).toBe('Zm8=')
  })

  it('encodes multibyte UTF-8 correctly', () => {
    expect(encodeBase64('你好').result).toBe('5L2g5aW9')
    const emoji = encodeBase64('👍')
    expect(emoji.ok).toBe(true)
    expect(decodeBase64(emoji.result).result).toBe('👍')
  })

  it('urlSafe replaces + and /', () => {
    const std = encodeBase64('subjects?_~ words/plus+minus').result
    const safe = encodeBase64('subjects?_~ words/plus+minus', { urlSafe: true }).result
    expect(safe).not.toContain('+')
    expect(safe).not.toContain('/')
    expect(safe.replace(/-/g, '+').replace(/_/g, '/')).toBe(std)
  })
})

describe('decodeBase64', () => {
  it('decodes standard input', () => {
    expect(decodeBase64('aGVsbG8=').result).toBe('hello')
    expect(decodeBase64('5L2g5aW9').result).toBe('你好')
  })

  it('tolerates whitespace and missing padding', () => {
    expect(decodeBase64('aGVs bG8\n=').result).toBe('hello')
    expect(decodeBase64('aGVsbG8').result).toBe('hello')
    expect(decodeBase64('Zg').result).toBe('f')
  })

  it('accepts URL-safe alphabet', () => {
    const safe = encodeBase64('subjects?_~ words/plus+minus', { urlSafe: true }).result
    expect(decodeBase64(safe).ok).toBe(true)
  })

  it('reports invalid characters with position', () => {
    const res = decodeBase64('ab@d')
    expect(res.ok).toBe(false)
    expect(res.error.message).toBe('invalid-char')
    expect(res.error.position).toBe(2)
    expect(res.error.char).toBe('@')
  })

  it('reports invalid UTF-8 payload', () => {
    // 0xFF 0xFE is not valid UTF-8
    const raw = btoa(String.fromCharCode(0xff, 0xfe))
    const res = decodeBase64(raw)
    expect(res.ok).toBe(false)
    expect(res.error.message).toBe('invalid-utf8')
  })

  it('rejects empty input', () => {
    expect(decodeBase64('').ok).toBe(false)
    expect(decodeBase64('   ').ok).toBe(false)
  })
})

describe('roundtrip on extreme sizes', () => {
  it('roundtrips a 1MB multilingual string', () => {
    const chunk = 'ascii 中文 😀🎉 \t\n"quotes"\\slash '
    const big = chunk.repeat(Math.ceil(1_000_000 / chunk.length)).slice(0, 1_000_000)
    const enc = encodeBase64(big)
    expect(enc.ok).toBe(true)
    const dec = decodeBase64(enc.result)
    expect(dec.ok).toBe(true)
    expect(dec.result).toBe(big)
  })

  it('roundtrips a 500KB CJK string', () => {
    const big = '开发助手'.repeat(125_000)
    const dec = decodeBase64(encodeBase64(big).result)
    expect(dec.result).toBe(big)
  })

  it('encodes a binary-ish control char string', () => {
    const s = String.fromCharCode(0, 1, 2, 254, 255)
    const dec = decodeBase64(encodeBase64(s).result)
    expect(dec.ok).toBe(true)
    expect(dec.result).toBe(s)
  })
})

describe('URL codec', () => {
  it('encodes and decodes', () => {
    const src = 'a=1&b=中文 c/d?e#f'
    const enc = encodeUrl(src)
    expect(enc.result).not.toMatch(/[&\s/#]/)
    expect(decodeUrl(enc.result).result).toBe(src)
  })

  it('decode fails gracefully on malformed input', () => {
    const res = decodeUrl('%ZZ')
    expect(res.ok).toBe(false)
    expect(res.error).toBeTruthy()
  })
})
