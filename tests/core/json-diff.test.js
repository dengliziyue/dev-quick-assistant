import { describe, it, expect } from 'vitest'
import { diffJson, lineDiff } from '../../src/core/json-diff'

describe('diffJson — primitives & objects', () => {
  it('identical documents produce zero diffs', () => {
    const res = diffJson('{"a":1,"b":[1,2]}', '{"a":1,"b":[1,2]}')
    expect(res.ok).toBe(true)
    expect(res.diffs).toHaveLength(0)
    expect(res.summary).toEqual({ added: 0, removed: 0, changed: 0, unchanged: expect.any(Number) })
    expect(res.truncated).toBe(false)
  })

  it('detects changed primitive', () => {
    const res = diffJson('{"a":1,"b":2}', '{"a":1,"b":3}')
    expect(res.summary.changed).toBe(1)
    expect(res.diffs[0]).toMatchObject({ path: '$.b', type: 'changed', left: 2, right: 3 })
  })

  it('detects added and removed keys with bracket paths for odd keys', () => {
    const res = diffJson('{"a":1}', '{"a":1,"new key":9}')
    expect(res.summary.added).toBe(1)
    expect(res.diffs[0].path).toBe('$["new key"]')

    const res2 = diffJson('{"x.y":1}', '{}')
    expect(res2.summary.removed).toBe(1)
    expect(res2.diffs[0].path).toBe('$["x.y"]')
  })

  it('handles nested additions', () => {
    const res = diffJson('{"o":{"a":1}}', '{"o":{"a":1,"b":{"c":2}}}')
    expect(res.summary.added).toBe(1)
    expect(res.diffs[0].path).toBe('$.o.b')
  })

  it('null vs object is a change', () => {
    const res = diffJson('{"a":null}', '{"a":{}}')
    expect(res.summary.changed).toBe(1)
  })
})

describe('diffJson — arrays', () => {
  it('element-wise compare for same length', () => {
    const res = diffJson('[1,2,3]', '[1,9,3]')
    expect(res.summary.changed).toBe(1)
    expect(res.diffs[0]).toMatchObject({ path: '$[1]', left: 2, right: 9 })
  })

  it('detects appended and removed elements', () => {
    const add = diffJson('[1,2]', '[1,2,3]')
    expect(add.summary.added).toBe(1)
    expect(add.diffs[0].path).toBe('$[2]')

    const del = diffJson('[1,2,3]', '[1,2]')
    expect(del.summary.removed).toBe(1)
    expect(del.diffs[0].path).toBe('$[2]')
  })

  it('array vs object is a single change', () => {
    const res = diffJson('{"a":[1]}', '{"a":{"0":1}}')
    expect(res.summary.changed).toBe(1)
  })

  it('top-level scalar change', () => {
    const res = diffJson('1', '"1"')
    expect(res.summary.changed).toBe(1)
    expect(res.diffs[0].path).toBe('$')
  })
})

describe('diffJson — error handling & budgets', () => {
  it('reports parse failures per side', () => {
    const res = diffJson('{bad}', '{"a":1}')
    expect(res.ok).toBe(false)
    expect(res.errorLeft).toBeTruthy()
    expect(res.errorRight).toBeUndefined()
  })

  it('respects maxNodes budget and flags truncation', () => {
    const big = Array.from({ length: 1000 }, (_, i) => ({ i, v: i }))
    const res = diffJson(JSON.stringify(big), JSON.stringify(big), { maxNodes: 50 })
    expect(res.ok).toBe(true)
    expect(res.truncated).toBe(true)
  })

  it('respects maxDiffs cap but counts everything', () => {
    const res = diffJson('{}', '{"a":1,"b":2,"c":3}', { maxDiffs: 2 })
    expect(res.summary.added).toBe(3)
    expect(res.diffs).toHaveLength(2)
  })
})

describe('diffJson — large payloads', () => {
  it('diffs ~1MB JSON successfully', () => {
    const mk = (off) =>
      JSON.stringify({
        users: Array.from({ length: 5000 }, (_, i) => ({ id: i, name: `u${i}`, score: i + off }))
      })
    const res = diffJson(mk(0), mk(1))
    expect(res.ok).toBe(true)
    expect(res.summary.changed).toBe(5000)
    expect(res.truncated).toBe(false)
  })
})

describe('lineDiff', () => {
  it('marks same/add/del lines', () => {
    const res = lineDiff(['a', 'b', 'c'], ['a', 'X', 'c'])
    const types = res.map((r) => r.type)
    expect(types).toEqual(['same', 'del', 'add', 'same'])
    expect(res.find((r) => r.type === 'del').text).toBe('b')
    expect(res.find((r) => r.type === 'add').text).toBe('X')
  })

  it('appends and removes trailing lines', () => {
    expect(lineDiff(['a'], ['a', 'b']).map((r) => r.type)).toEqual(['same', 'add'])
    expect(lineDiff(['a', 'b'], ['a']).map((r) => r.type)).toEqual(['same', 'del'])
  })

  it('falls back gracefully beyond DP budget', () => {
    const a = Array.from({ length: 4000 }, (_, i) => `l${i}`)
    const b = Array.from({ length: 4000 }, (_, i) => `l${i}`)
    const res = lineDiff(a, b, { maxCells: 1000 })
    expect(res.length).toBe(8000)
    expect(res.every((r) => r.type === 'del' || r.type === 'add')).toBe(true)
  })
})
