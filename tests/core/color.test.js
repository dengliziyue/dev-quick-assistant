import { describe, it, expect } from 'vitest'
import {
  parseColor,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  rgbToHsv,
  formatRgb,
  formatRgba,
  formatHsl,
  formatHsla,
  luminance,
  contrastRatio,
  bestTextColor,
  shadeScale,
  NAMED_COLORS
} from '../../src/core/color'

describe('parseColor', () => {
  it('parses hex 3/4/6/8 digit forms', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(parseColor('#000')).toEqual({ r: 0, g: 0, b: 0, a: 1 })
    expect(parseColor('#4F5FD5')).toEqual({ r: 79, g: 95, b: 213, a: 1 })
    expect(parseColor('#f00c')).toEqual({ r: 255, g: 0, b: 0, a: 204 / 255 })
    expect(parseColor('#4F5FD580').a).toBeCloseTo(0x80 / 255, 3)
  })

  it('parses rgb/rgba legacy and percentage syntax', () => {
    expect(parseColor('rgb(79, 95, 213)')).toEqual({ r: 79, g: 95, b: 213, a: 1 })
    expect(parseColor('rgba(255, 0, 0, 0.5)')).toEqual({ r: 255, g: 0, b: 0, a: 0.5 })
    expect(parseColor('rgb(50%, 0%, 100%)')).toEqual({ r: 128, g: 0, b: 255, a: 1 })
    expect(parseColor('rgb(300, -20, 0)')).toEqual({ r: 255, g: 0, b: 0, a: 1 })
  })

  it('parses modern space-separated syntax with slash alpha', () => {
    const c = parseColor('rgb(255 0 0 / 0.5)')
    expect(c).toEqual({ r: 255, g: 0, b: 0, a: 0.5 })
    const h = parseColor('hsl(230 60% 57% / 80%)')
    expect(h.r).toBeGreaterThan(0)
    expect(h.a).toBeCloseTo(0.8, 3)
  })

  it('parses hsl/hsla', () => {
    const c = parseColor('hsl(0, 100%, 50%)')
    expect(c).toEqual({ r: 255, g: 0, b: 0, a: 1 })
    const c2 = parseColor('hsla(120, 100%, 50%, 0.25)')
    expect(c2.g).toBe(255)
    expect(c2.a).toBe(0.25)
  })

  it('parses named colors', () => {
    expect(parseColor('tomato')).toEqual({ r: 255, g: 99, b: 71, a: 1 })
    expect(parseColor('RebeccaPurple')).toEqual({ r: 0x66, g: 0x33, b: 0x99, a: 1 })
    expect(parseColor('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 })
    // every named color entry parses
    for (const [name, hex] of Object.entries(NAMED_COLORS)) {
      const parsed = parseColor(name)
      expect(parsed, name).not.toBeNull()
      expect(rgbToHex(parsed).toLowerCase()).toBe(hex)
    }
  })

  it('returns null for invalid input', () => {
    for (const bad of ['', null, undefined, 'not-a-color', 'rgb(1,2)', 'hsl(300,50)', '#ff', '#zzzzzz', 'rgb(a,b,c)']) {
      expect(parseColor(bad), String(bad)).toBeNull()
    }
  })
})

describe('conversions round-trip', () => {
  it('hex -> hsl -> hex stays stable (±2 per channel)', () => {
    for (const hex of ['#4F5FD5', '#FF6347', '#123456', '#00FF7F', '#8B4513']) {
      const rgb = parseColor(hex)
      const hsl = rgbToHsl(rgb)
      const back = hslToRgb(hsl.h, hsl.s, hsl.l)
      expect(Math.abs(back.r - rgb.r)).toBeLessThanOrEqual(2)
      expect(Math.abs(back.g - rgb.g)).toBeLessThanOrEqual(2)
      expect(Math.abs(back.b - rgb.b)).toBeLessThanOrEqual(2)
    }
  })

  it('formats all output styles', () => {
    const c = { r: 79, g: 95, b: 213, a: 0.5 }
    expect(formatRgb(c)).toBe('rgb(79, 95, 213)')
    expect(formatRgba(c)).toBe('rgba(79, 95, 213, 0.5)')
    expect(rgbToHex(c)).toBe('#4F5FD580')
    expect(rgbToHex({ r: 79, g: 95, b: 213 })).toBe('#4F5FD5')
    expect(formatHsl(c)).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/)
    expect(formatHsla(c)).toMatch(/^hsla\(\d+, \d+%, \d+%, 0\.5\)$/)
  })

  it('rgbToHsv known values', () => {
    expect(rgbToHsv({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, v: 100 })
    expect(rgbToHsv({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, v: 0 })
  })
})

describe('contrast', () => {
  const WHITE = { r: 255, g: 255, b: 255 }
  const BLACK = { r: 0, g: 0, b: 0 }

  it('black vs white is 21', () => {
    expect(contrastRatio(BLACK, WHITE)).toBe(21)
  })

  it('same color is 1', () => {
    expect(contrastRatio(WHITE, WHITE)).toBe(1)
  })

  it('computes WCAG ratio for mid gray', () => {
    const ratio = contrastRatio(parseColor('#777777'), WHITE)
    expect(Math.abs(ratio - 4.48)).toBeLessThan(0.02)
  })

  it('luminance bounds', () => {
    expect(luminance(WHITE)).toBeCloseTo(1, 5)
    expect(luminance(BLACK)).toBe(0)
  })

  it('bestTextColor picks readable option', () => {
    expect(bestTextColor(WHITE)).toBe('#000000')
    expect(bestTextColor(BLACK)).toBe('#FFFFFF')
    expect(bestTextColor(parseColor('#4F5FD5'))).toBe('#FFFFFF')
  })
})

describe('shadeScale', () => {
  it('produces 10 steps from light to dark', () => {
    const scale = shadeScale(parseColor('#4F5FD5'))
    expect(scale).toHaveLength(10)
    expect(scale[0].level).toBe(100)
    expect(scale[9].level).toBe(1000)
    for (let i = 1; i < scale.length; i++) {
      expect(luminance(scale[i].rgb)).toBeLessThan(luminance(scale[i - 1].rgb))
    }
    // endpoints are grayscale-ish extremes of same hue
    expect(scale[0].hex).toMatch(/^#[0-9A-F]{6}$/)
  })
})
