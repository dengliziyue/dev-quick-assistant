import { describe, it, expect } from 'vitest'
import {
  parseJson,
  formatJson,
  minifyJson,
  sortJsonKeys,
  sortKeysDeep,
  escapeJsonString,
  unescapeJsonString,
  jsonStats,
  positionToLineCol,
  highlightJson,
  HIGHLIGHT_LIMIT
} from '../../src/core/json-format'

describe('parseJson', () => {
  it('parses valid JSON including primitives', () => {
    expect(parseJson('null')).toEqual({ ok: true, data: null })
    expect(parseJson('42')).toEqual({ ok: true, data: 42 })
    expect(parseJson('{"a":[1,2]}')).toEqual({ ok: true, data: { a: [1, 2] } })
  })

  it('rejects empty and invalid input with error info', () => {
    for (const bad of ['', '   ', '{', 'undefined', '{"a":1}x', '[1,]']) {
      const res = parseJson(bad)
      expect(res.ok).toBe(false)
      expect(res.error.message).toBeTruthy()
    }
  })

  it('maps error position to line/col when V8 provides one', () => {
    const text = '{\n  "a": 1,\n  "b": @@\n}'
    const res = parseJson(text)
    expect(res.ok).toBe(false)
    if (res.error.line != null) {
      expect(res.error.line).toBeGreaterThanOrEqual(1)
      expect(res.error.col).toBeGreaterThanOrEqual(1)
    }
  })

  it('positionToLineCol is exact', () => {
    const text = 'ab\ncdef\ngh'
    expect(positionToLineCol(text, 0)).toEqual({ line: 1, col: 1 })
    expect(positionToLineCol(text, 3)).toEqual({ line: 2, col: 1 })
    expect(positionToLineCol(text, 5)).toEqual({ line: 2, col: 3 })
    expect(positionToLineCol(text, 8)).toEqual({ line: 3, col: 1 })
    expect(positionToLineCol(text, 9)).toEqual({ line: 3, col: 2 })
    // clamping
    expect(positionToLineCol(text, 999).line).toBe(3)
  })
})

describe('formatJson / minifyJson', () => {
  const src = '{"b":1,"a":[1,{"y":2,"x":3}]}'

  it('formats with 2/4 spaces and tab', () => {
    expect(formatJson(src, '2').result).toBe('{\n  "b": 1,\n  "a": [\n    1,\n    {\n      "y": 2,\n      "x": 3\n    }\n  ]\n}')
    expect(formatJson(src, '4').result).toContain('    "b": 1')
    expect(formatJson(src, 'tab').result).toContain('\t"b": 1')
  })

  it('minifies', () => {
    expect(minifyJson('{ "a" : 1 }').result).toBe('{"a":1}')
  })

  it('keeps key order by default', () => {
    expect(formatJson(src, 'minify').result).toBe(src)
  })

  it('propagates parse errors', () => {
    expect(formatJson('nope', '2').ok).toBe(false)
  })
})

describe('sortJsonKeys', () => {
  it('sorts object keys recursively, arrays keep order', () => {
    const res = sortJsonKeys('{"b":{"d":1,"c":2},"a":[2,1,{"z":1,"y":2}]}')
    expect(res.ok).toBe(true)
    expect(res.result).toBe(
      JSON.stringify({ a: [2, 1, { y: 2, z: 1 }], b: { c: 2, d: 1 } }, null, 2)
    )
  })

  it('sortKeysDeep handles empty objects and non-ASCII keys', () => {
    expect(sortKeysDeep({})).toEqual({})
    expect(Object.keys(sortKeysDeep({ '中': 1, 'a': 2, 'B': 3 }))).toEqual(['B', 'a', '中'])
  })
})

describe('escape / unescape', () => {
  it('roundtrips tricky text', () => {
    const cases = ['a"b\\c\nd\te', '中文', '😀👍', 'line\nbreak\ttab', '']
    for (const c of cases) {
      const enc = escapeJsonString(c)
      expect(enc.ok).toBe(true)
      const dec = unescapeJsonString(enc.result)
      expect(dec.ok).toBe(true)
      expect(dec.result).toBe(c)
    }
  })

  it('escapes control chars to \\u form when needed', () => {
    expect(escapeJsonString('\u0001').result).toBe('"\\u0001"')
  })

  it('unescape accepts unquoted input with a note', () => {
    const res = unescapeJsonString('a\\nb')
    expect(res.ok).toBe(true)
    expect(res.result).toBe('a\nb')
    expect(res.note).toBe('unquoted')
  })

  it('unescape rejects broken escape', () => {
    expect(unescapeJsonString('"\\x41"').ok).toBe(false)
  })
})

describe('jsonStats', () => {
  it('counts bytes, chars, lines, depth', () => {
    const stats = jsonStats('{"a":[1,2]}\n')
    expect(stats.chars).toBe(12)
    expect(stats.lines).toBe(2)
    expect(stats.depth).toBe(2)
    expect(stats.bytes).toBeGreaterThanOrEqual(stats.chars)
  })

  it('depth for deep structures', () => {
    expect(jsonStats('[[[1]]]').depth).toBe(3)
    expect(jsonStats('1').depth).toBe(0)
  })
})

describe('highlightJson', () => {
  it('wraps tokens and escapes HTML', () => {
    const html = highlightJson('{"<b>": true, "n": 1.5e3, "z": null}')
    expect(html).toContain('tok-key')
    expect(html).toContain('tok-bool')
    expect(html).toContain('tok-num')
    expect(html).toContain('tok-null')
    expect(html).toContain('&lt;b&gt;')
    expect(html).not.toContain('<b>')
  })

  it('handles escaped quotes inside strings', () => {
    const html = highlightJson('{"a":"say \\"hi\\""}')
    expect(html).toContain('tok-key')
    expect(html).toContain('tok-str')
  })
})

describe('edge cases: huge / deep JSON', () => {
  it('formats a ~2MB JSON without failure and minify roundtrips', () => {
    const big = {
      users: Array.from({ length: 20_000 }, (_, i) => ({
        id: i,
        name: `user-${i}-with-a-fairly-long-name-to-inflate-size`,
        tags: ['x', 'y', 'z'],
        meta: { active: i % 2 === 0, score: i * 1.5, note: 'n'.repeat(30) }
      }))
    }
    const raw = JSON.stringify(big)
    expect(raw.length).toBeGreaterThan(HIGHLIGHT_LIMIT)

    const formatted = formatJson(raw, '2')
    expect(formatted.ok).toBe(true)
    const min = minifyJson(formatted.result)
    expect(min.ok).toBe(true)
    expect(min.result).toBe(raw)

    const stats = jsonStats(formatted.result)
    expect(stats.depth).toBe(4)
  })

  it('does not crash on pathological nesting (returns ok or graceful error)', () => {
    const deep = '['.repeat(50_000) + '1' + ']'.repeat(50_000)
    let res
    expect(() => {
      res = formatJson(deep, '2')
    }).not.toThrow()
    expect(res).toBeDefined()
    expect(typeof res.ok).toBe('boolean')
  })

  it('handles very long string values', () => {
    const long = 'x'.repeat(500_000)
    const raw = JSON.stringify({ v: long })
    const res = formatJson(raw, '2')
    expect(res.ok).toBe(true)
    expect(res.result).toContain(long)
  })
})
