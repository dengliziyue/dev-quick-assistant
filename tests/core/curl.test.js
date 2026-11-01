import { describe, it, expect } from 'vitest'
import { toCurl, toFetch, recordToTransferable } from '../../src/core/curl'

describe('toCurl', () => {
  it('minimal GET', () => {
    expect(toCurl({ method: 'GET', url: 'https://a.b/c', headers: [] })).toBe(
      "curl 'https://a.b/c'"
    )
  })

  it('POST with headers and body, multiline', () => {
    const cmd = toCurl({
      method: 'POST',
      url: 'https://api.example.com/v1/users',
      headers: [
        ['content-type', 'application/json'],
        ['authorization', 'Bearer tok']
      ],
      body: '{"name":"dev"}'
    })
    expect(cmd).toContain("'https://api.example.com/v1/users'")
    expect(cmd).toContain('-X POST')
    expect(cmd).toContain("-H 'content-type: application/json'")
    expect(cmd).toContain("-H 'authorization: Bearer tok'")
    expect(cmd).toContain("--data-raw '{\"name\":\"dev\"}'")
    expect(cmd).toContain(' \\\n  ')
  })

  it('single-line mode', () => {
    const cmd = toCurl({ method: 'GET', url: 'https://a.b/?x=1', headers: [['a', 'b']] }, { multiline: false })
    expect(cmd).not.toContain('\\\n')
    expect(cmd).toContain("-H 'a: b'")
  })

  it('escapes single quotes in any field', () => {
    const cmd = toCurl({
      method: 'POST',
      url: "https://a.b/it's",
      headers: [['x-note', "bob's data"]],
      body: "say 'hi'"
    })
    expect(cmd).toContain("'https://a.b/it'\\''s'")
    expect(cmd).toContain("'x-note: bob'\\''s data'")
    expect(cmd).toContain("'say '\\''hi'")
  })

  it('empty header value renders as header-only directive', () => {
    const cmd = toCurl({ method: 'GET', url: 'https://a.b', headers: [['x-empty', '']] })
    expect(cmd).toContain("-H 'x-empty;'")
  })

  it('omits body when empty string', () => {
    const cmd = toCurl({ method: 'POST', url: 'https://a.b', headers: [], body: '' })
    expect(cmd).not.toContain('--data-raw')
  })

  it('keeps query strings intact', () => {
    const cmd = toCurl({ method: 'GET', url: 'https://a.b/p?a=1&b=%E4%B8%AD', headers: [] })
    expect(cmd).toContain('a=1&b=%E4%B8%AD')
  })
})

describe('toFetch', () => {
  it('simple GET omits method/headers/body', () => {
    const snip = toFetch({ method: 'GET', url: 'https://a.b/c', headers: [] })
    expect(snip).toBe('const res = await fetch("https://a.b/c", {\n});')
  })

  it('POST with headers and body', () => {
    const snip = toFetch({
      method: 'POST',
      url: 'https://api.example.com/v1/users',
      headers: [['content-type', 'application/json']],
      body: '{"a":1}'
    })
    expect(snip).toContain('method: "POST"')
    expect(snip).toContain('headers: {"content-type":"application/json"}')
    expect(snip).toContain('body: "{\\"a\\":1}"')
  })

  it('escaping keeps the snippet valid JS', () => {
    const snip = toFetch({
      method: 'POST',
      url: 'https://a.b',
      headers: [],
      body: 'He said "hi"\nline2'
    })
    expect(snip).toContain('"He said \\"hi\\"\\nline2"')
    // The generated body literal must be evaluable
    const bodyMatch = /body: ("(?:[^"\\]|\\.)*")/.exec(snip)
    expect(bodyMatch).toBeTruthy()
    expect(JSON.parse(bodyMatch[1])).toBe('He said "hi"\nline2')
  })

  it('uppercases method for output', () => {
    const snip = toFetch({ method: 'delete', url: 'https://a.b', headers: [] })
    expect(snip).toContain('method: "DELETE"')
  })
})

describe('recordToTransferable', () => {
  it('maps a captured record', () => {
    const rec = {
      method: 'post',
      url: 'https://x.y/z',
      reqHeaders: [['a', '1'], ['b', null]],
      body: 'data'
    }
    const t = recordToTransferable(rec)
    expect(t.method).toBe('post')
    expect(t.headers).toEqual([['a', '1'], ['b', '']])
    expect(t.body).toBe('data')
  })

  it('survives empty/missing records', () => {
    expect(recordToTransferable(null)).toEqual({ method: 'GET', url: '', headers: [], body: '' })
    expect(recordToTransferable({}).body).toBe('')
  })
})
