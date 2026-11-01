import { describe, it, expect } from 'vitest'
import {
  compileRegex,
  runRegex,
  replaceRegex,
  REGEX_PRESETS,
  escapeRegexLiteral,
  MAX_TEST_LEN
} from '../../src/core/regex'

describe('compileRegex', () => {
  it('compiles valid patterns', () => {
    expect(compileRegex('a+', 'g').ok).toBe(true)
  })

  it('rejects syntactically invalid patterns with friendly errors', () => {
    // Note: Annex-B web compat makes 'a{' and '\2' legal in non-unicode mode,
    // so only patterns invalid in both modes are listed here.
    for (const bad of ['(', '[a-', '(?<x', '*', '(?P<name>x)', '\\']) {
      const res = compileRegex(bad, 'g')
      expect(res.ok, `pattern ${bad} should fail`).toBe(false)
      expect(res.error.message).toBeTruthy()
      expect(res.error.stage).toBe('compile')
    }
    // invalid group reference becomes an error under the u flag
    expect(compileRegex('(a)\\2', 'u').ok).toBe(false)
  })

  it('rejects invalid flags', () => {
    expect(compileRegex('a', 'gx').ok).toBe(false)
    expect(compileRegex('a', 'q!').ok).toBe(false)
  })

  it('rejects empty pattern', () => {
    expect(compileRegex('', '').ok).toBe(false)
  })
})

describe('runRegex — matching', () => {
  it('collects global matches with indices', () => {
    const res = runRegex('\\d+', 'g', 'a1 b22 c333')
    expect(res.ok).toBe(true)
    expect(res.count).toBe(3)
    expect(res.matches.map((m) => m.text)).toEqual(['1', '22', '333'])
    expect(res.matches.map((m) => m.index)).toEqual([1, 4, 8])
  })

  it('non-global returns first match only', () => {
    const res = runRegex('a', '', 'banana')
    expect(res.count).toBe(1)
    expect(res.matches[0].index).toBe(1)
  })

  it('captures groups and named groups', () => {
    const res = runRegex('(\\d{4})-(\\d{2})', 'g', '2024-01 and 1999-12')
    expect(res.matches[0].groups).toEqual(['2024', '01'])
    expect(res.matches[1].groups).toEqual(['1999', '12'])

    const named = runRegex('(?<year>\\d{4})', 'g', 'in 2024')
    expect(named.matches[0].named).toEqual({ year: '2024' })
  })

  it('respects the i flag', () => {
    expect(runRegex('abc', 'i', 'XABCX').count).toBe(1)
  })

  it('handles zero-length matches without infinite loop', () => {
    const res = runRegex('a*', 'g', 'bbb')
    expect(res.ok).toBe(true)
    expect(res.count).toBe(4) // '', '', '', '' at 0,1,2,3
    expect(res.matches.every((m) => m.text === '')).toBe(true)
  })

  it('handles sticky and unicode flags', () => {
    expect(runRegex('a', 'y', 'aa').count).toBe(1)
    expect(runRegex('👍+', 'gu', '👍👍👍').matches[0].text).toBe('👍👍👍')
  })
})

describe('runRegex — guards', () => {
  it('truncates overlong input', () => {
    const big = 'a'.repeat(MAX_TEST_LEN + 1000) + 'END'
    const res = runRegex('END', '', big)
    expect(res.textCut).toBe(true)
    expect(res.textUsed.length).toBe(MAX_TEST_LEN)
    expect(res.count).toBe(0)
  })

  it('stops at maxMatches and marks truncation', () => {
    const res = runRegex('a', 'g', 'a'.repeat(100), { maxMatches: 5 })
    expect(res.count).toBe(5)
    expect(res.truncated).toBe(true)
    expect(res.matches).toHaveLength(5)
  })

  it('reports errors instead of throwing', () => {
    // bad group reference throws under u flag — surfaced as an error object
    const res = runRegex('(a)\\2', 'u', 'aa')
    expect(res.ok).toBe(false)
    expect(res.error.stage).toBe('compile')
  })

  it('empty text works', () => {
    expect(runRegex('x', 'g', '').count).toBe(0)
  })
})

describe('replaceRegex', () => {
  it('supports $1 and named refs', () => {
    expect(replaceRegex('(\\w+)@(\\w+)', 'g', 'a@b c@d', '$2-$1').result).toBe('b-a d-c')
    expect(replaceRegex('(?<x>\\d)', 'g', 'a1b2', '<$<x>>').result).toBe('a<1>b<2>')
  })

  it('replacement edge cases behave per spec and never throw', () => {
    // unknown named-group reference substitutes an empty string (spec behavior)
    expect(replaceRegex('(?<y>a)', 'g', 'aaa', '$<x>').result).toBe('')
    // unknown numeric reference stays literal
    expect(replaceRegex('(a)', 'g', 'aaa', '$2').result).toBe('$2$2$2')
  })

  it('propagates invalid regex', () => {
    expect(replaceRegex('(', '', 'x', 'y').ok).toBe(false)
  })
})

describe('presets & escaping', () => {
  it('presets compile and match their sample', () => {
    const samples = {
      email: 'mail: foo.bar+baz@example.co.uk !',
      url: 'see https://example.com/x?y=1 now',
      ip: 'ip 192.168.1.100 end',
      date: 'on 2024-06-01 we',
      mobile: 'call 13812345678 ok',
      hex: '#fff and #AB12CD88 both'
    }
    for (const p of REGEX_PRESETS) {
      const compiled = compileRegex(p.pattern, p.flags)
      expect(compiled.ok, p.id).toBe(true)
      const res = runRegex(p.pattern, p.flags, samples[p.id])
      expect(res.count, p.id).toBeGreaterThanOrEqual(1)
    }
  })

  it('escapeRegexLiteral neutralizes metacharacters', () => {
    const danger = '.*+?[]{}()^$|\\'
    const re = new RegExp(escapeRegexLiteral(danger))
    expect(re.test(danger)).toBe(true)
  })
})
