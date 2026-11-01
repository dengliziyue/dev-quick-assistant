import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  formatBytes,
  truncate,
  truncateMiddle,
  debounce,
  clamp,
  previewValue,
  formatDuration,
  formatClock
} from '../../src/utils/format'

describe('formatBytes', () => {
  it('renders bytes and KB/MB/GB', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatBytes(3 * 1024 ** 3)).toBe('3.0 GB')
    expect(formatBytes(7.3 * 1024 ** 4)).toContain('TB')
  })

  it('large KB drops decimals', () => {
    expect(formatBytes(900 * 1024, 1)).toBe('900 KB')
  })

  it('handles bad input', () => {
    expect(formatBytes(NaN)).toBe('0 B')
    expect(formatBytes(-5)).toBe('0 B')
  })
})

describe('truncate / truncateMiddle', () => {
  it('truncates with suffix', () => {
    expect(truncate('abcdef', 4)).toBe('abcd…')
    expect(truncate('ab', 4)).toBe('ab')
    expect(truncate(null, 4)).toBe('')
  })

  it('middle keeps both ends', () => {
    const s = 'https://example.com/very/long/path/segment'
    const out = truncateMiddle(s, 20)
    expect(out.length).toBeLessThanOrEqual(20)
    expect(out).toContain('…')
    expect(out.startsWith('https://e')).toBe(true)
    expect(out.endsWith('h/segment')).toBe(true)
  })

  it('middle passthrough for short strings', () => {
    expect(truncateMiddle('short', 20)).toBe('short')
  })
})

describe('debounce', () => {
  afterEach(() => vi.useRealTimers())

  it('debounces trailing call', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const d = debounce(fn, 100)
    d('a')
    d('b')
    d('c')
    vi.advanceTimersByTime(50)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('c')
  })

  it('cancel prevents call', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const d = debounce(fn, 100)
    d()
    d.cancel()
    vi.advanceTimersByTime(200)
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('clamp', () => {
  it('clamps', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(11, 0, 10)).toBe(10)
  })
})

describe('previewValue', () => {
  it('stringifies and truncates', () => {
    expect(previewValue('hi')).toBe('"hi"')
    expect(previewValue(42)).toBe('42')
    expect(previewValue(true)).toBe('true')
    expect(previewValue(null)).toBe('null')
    expect(previewValue({ a: 1 })).toBe('{"a":1}')
    // strings get quoted then truncated
    const long = previewValue('x'.repeat(200), 12)
    expect(long.startsWith('"')).toBe(true)
    expect(long.endsWith('…')).toBe(true)
    expect(long.length).toBeLessThanOrEqual(13)
    expect(previewValue(1234567890123, 6)).toBe('123456…')
    expect(previewValue(undefined)).toBe('')
  })
})

describe('formatDuration / formatClock', () => {
  it('formats durations', () => {
    expect(formatDuration(0.4)).toBe('<1ms')
    expect(formatDuration(12)).toBe('12ms')
    expect(formatDuration(1500)).toBe('1.50s')
    expect(formatDuration(NaN)).toBe('-')
  })

  it('formats clock with padding', () => {
    expect(formatClock(new Date(2024, 0, 1, 3, 4, 5).getTime())).toBe('03:04:05')
  })
})
