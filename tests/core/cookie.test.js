import { describe, it, expect } from 'vitest'
import {
  cookiesToJson,
  cookiesToNetscape,
  cookiesToHeader,
  parseImportCookies,
  cookieToSetParams,
  formatExpiry
} from '../../src/core/cookie'

const sample = [
  {
    name: 'session_id',
    value: 'abc123',
    domain: '.example.com',
    path: '/',
    secure: true,
    httpOnly: true,
    expirationDate: 1800000000
  },
  {
    name: 'theme',
    value: 'dark',
    domain: 'sub.example.com',
    path: '/app',
    secure: false,
    httpOnly: false
  }
]

describe('cookiesToNetscape', () => {
  it('renders header + tab separated rows', () => {
    const txt = cookiesToNetscape(sample)
    expect(txt).toContain('# Netscape HTTP Cookie File')
    const lines = txt.split('\n').filter((l) => l && !l.startsWith('# '))
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe('#HttpOnly_.example.com\tTRUE\t/\tTRUE\t1800000000\tsession_id\tabc123')
    expect(lines[1]).toBe('sub.example.com\tFALSE\t/app\tFALSE\t0\ttheme\tdark')
  })

  it('marks httpOnly lines with #HttpOnly_ prefix', () => {
    const txt = cookiesToNetscape([sample[0]])
    expect(txt).toContain('#HttpOnly_.example.com\tTRUE')
  })

  it('handles empty list', () => {
    const txt = cookiesToNetscape([])
    expect(txt).toContain('# Netscape HTTP Cookie File')
    expect(txt.split('\n').filter((l) => l && !l.startsWith('#'))).toHaveLength(0)
  })
})

describe('cookiesToHeader', () => {
  it('joins name=value pairs', () => {
    expect(cookiesToHeader(sample)).toBe('session_id=abc123; theme=dark')
  })
  it('empty list -> empty string', () => {
    expect(cookiesToHeader([])).toBe('')
  })
})

describe('cookiesToJson / parseImportCookies roundtrip', () => {
  it('roundtrips the important fields', () => {
    const json = cookiesToJson(sample)
    const parsed = parseImportCookies(json)
    expect(parsed.ok).toBe(true)
    expect(parsed.cookies).toHaveLength(2)
    expect(parsed.cookies[0]).toMatchObject({
      name: 'session_id',
      value: 'abc123',
      domain: '.example.com',
      hostOnly: false,
      httpOnly: true,
      expirationDate: 1800000000
    })
    expect(parsed.cookies[1].hostOnly).toBe(true)
    expect(parsed.cookies[1].expirationDate).toBeNull()
  })

  it('rejects non-array and invalid JSON', () => {
    expect(parseImportCookies('{"a":1}').ok).toBe(false)
    expect(parseImportCookies('not json').ok).toBe(false)
  })

  it('skips entries without name/domain, defaults path', () => {
    const res = parseImportCookies(
      JSON.stringify([{ name: '', domain: 'x.com' }, { name: 'ok', domain: 'y.com' }, null])
    )
    expect(res.ok).toBe(true)
    expect(res.cookies).toHaveLength(1)
    expect(res.cookies[0].path).toBe('/')
  })
})

describe('cookieToSetParams', () => {
  it('hostOnly cookies omit domain and use https when secure', () => {
    const params = cookieToSetParams({ name: 'a', value: 'b', domain: 'x.com', path: '/', secure: true })
    expect(params.domain).toBeUndefined()
    expect(params.url).toBe('https://x.com/')
    expect(params.secure).toBe(true)
  })

  it('domain cookies include dot-domain and http when not secure', () => {
    const params = cookieToSetParams({ name: 'a', value: 'b', domain: '.x.com', path: '/p' })
    expect(params.domain).toBe('.x.com')
    expect(params.url).toBe('http://x.com/p')
  })

  it('strips leading dot of domain for URL host', () => {
    const params = cookieToSetParams({ name: 'a', value: 'b', domain: '.x.com', path: '/' })
    expect(params.url).toContain('://x.com/')
  })

  it('passes expirationDate and sameSite', () => {
    const params = cookieToSetParams({
      name: 'a',
      value: 'b',
      domain: '.x.com',
      path: '/',
      expirationDate: 12.9,
      sameSite: 'lax'
    })
    expect(params.expirationDate).toBe(12)
    expect(params.sameSite).toBe('lax')
  })
})

describe('formatExpiry', () => {
  it('session cookies and dates', () => {
    expect(formatExpiry({})).toBe('session')
    expect(formatExpiry({ expirationDate: 0 })).toBe('session')
    const txt = formatExpiry({ expirationDate: Date.UTC(2026, 0, 1) / 1000 })
    expect(txt).toContain('2026-01-01')
    expect(txt).toContain('UTC')
  })
})
