/**
 * Color conversion core: parse (hex/rgb/hsl/named), convert, contrast, scale.
 * Pure functions. Unit tested in tests/core/color.test.js
 */

export const NAMED_COLORS = {
  aliceblue: '#f0f8ff', antiquewhite: '#faebd7', aqua: '#00ffff', aquamarine: '#7fffd4',
  azure: '#f0ffff', beige: '#f5f5dc', bisque: '#ffe4c4', black: '#000000',
  blanchedalmond: '#ffebcd', blue: '#0000ff', blueviolet: '#8a2be2', brown: '#a52a2a',
  burlywood: '#deb887', cadetblue: '#5f9ea0', chartreuse: '#7fff00', chocolate: '#d2691e',
  coral: '#ff7f50', cornflowerblue: '#6495ed', cornsilk: '#fff8dc', crimson: '#dc143c',
  cyan: '#00ffff', darkblue: '#00008b', darkcyan: '#008b8b', darkgoldenrod: '#b8860b',
  darkgray: '#a9a9a9', darkgreen: '#006400', darkgrey: '#a9a9a9', darkkhaki: '#bdb76b',
  darkmagenta: '#8b008b', darkolivegreen: '#556b2f', darkorange: '#ff8c00', darkorchid: '#9932cc',
  darkred: '#8b0000', darksalmon: '#e9967a', darkseagreen: '#8fbc8f', darkslateblue: '#483d8b',
  darkslategray: '#2f4f4f', darkslategrey: '#2f4f4f', darkturquoise: '#00ced1', darkviolet: '#9400d3',
  deeppink: '#ff1493', deepskyblue: '#00bfff', dimgray: '#696969', dimgrey: '#696969',
  dodgerblue: '#1e90ff', firebrick: '#b22222', floralwhite: '#fffaf0', forestgreen: '#228b22',
  fuchsia: '#ff00ff', gainsboro: '#dcdcdc', ghostwhite: '#f8f8ff', gold: '#ffd700',
  goldenrod: '#daa520', gray: '#808080', grey: '#808080', green: '#008000',
  greenyellow: '#adff2f', honeydew: '#f0fff0', hotpink: '#ff69b4', indianred: '#cd5c5c',
  indigo: '#4b0082', ivory: '#fffff0', khaki: '#f0e68c', lavender: '#e6e6fa',
  lavenderblush: '#fff0f5', lawngreen: '#7cfc00', lemonchiffon: '#fffacd', lightblue: '#add8e6',
  lightcoral: '#f08080', lightcyan: '#e0ffff', lightgoldenrodyellow: '#fafad2', lightgray: '#d3d3d3',
  lightgreen: '#90ee90', lightgrey: '#d3d3d3', lightpink: '#ffb6c1', lightsalmon: '#ffa07a',
  lightseagreen: '#20b2aa', lightskyblue: '#87cefa', lightslategray: '#778899', lightslategrey: '#778899',
  lightsteelblue: '#b0c4de', lightyellow: '#ffffe0', lime: '#00ff00', limegreen: '#32cd32',
  linen: '#faf0e6', magenta: '#ff00ff', maroon: '#800000', mediumaquamarine: '#66cdaa',
  mediumblue: '#0000cd', mediumorchid: '#ba55d3', mediumpurple: '#9370db', mediumseagreen: '#3cb371',
  mediumslateblue: '#7b68ee', mediumspringgreen: '#00fa9a', mediumturquoise: '#48d1cc',
  mediumvioletred: '#c71585', midnightblue: '#191970', mintcream: '#f5fffa', mistyrose: '#ffe4e1',
  moccasin: '#ffe4b5', navajowhite: '#ffdead', navy: '#000080', oldlace: '#fdf5e6',
  olive: '#808000', olivedrab: '#6b8e23', orange: '#ffa500', orangered: '#ff4500',
  orchid: '#da70d6', palegoldenrod: '#eee8aa', palegreen: '#98fb98', paleturquoise: '#afeeee',
  palevioletred: '#db7093', papayawhip: '#ffefd5', peachpuff: '#ffdab9', peru: '#cd853f',
  pink: '#ffc0cb', plum: '#dda0dd', powderblue: '#b0e0e6', purple: '#800080',
  rebeccapurple: '#663399', red: '#ff0000', rosybrown: '#bc8f8f', royalblue: '#4169e1',
  saddlebrown: '#8b4513', salmon: '#fa8072', sandybrown: '#f4a460', seagreen: '#2e8b57',
  seashell: '#fff5ee', sienna: '#a0522d', silver: '#c0c0c0', skyblue: '#87ceeb',
  slateblue: '#6a5acd', slategray: '#708090', slategrey: '#708090', snow: '#fffafa',
  springgreen: '#00ff7f', steelblue: '#4682b4', tan: '#d2b48c', teal: '#008080',
  thistle: '#d8bfd8', tomato: '#ff6347', turquoise: '#40e0d0', violet: '#ee82ee',
  wheat: '#f5deb3', white: '#ffffff', whitesmoke: '#f5f5f5', yellow: '#ffff00',
  yellowgreen: '#9acd32', transparent: '#00000000'
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const round2 = (n) => Math.round(n * 100) / 100

function hexToRgb(hex) {
  let h = hex.slice(1)
  if (h.length === 3 || h.length === 4) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  }
  if (h.length !== 6 && h.length !== 8) return null
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
  if ([r, g, b].some((x) => Number.isNaN(x))) return null
  return { r, g, b, a }
}

function parseNumList(inner) {
  // comma separated (legacy) or whitespace/slash separated (modern syntax)
  const parts = inner.includes(',') ? inner.split(',') : inner.split(/[\s/]+/)
  return parts.map((p) => p.trim()).filter((p) => p.length > 0 && p !== '/')
}

function numOrPercent(token, scale = 255) {
  if (token == null) return NaN
  const t = token.trim()
  if (t.endsWith('%')) {
    const v = parseFloat(t)
    return Number.isNaN(v) ? NaN : (v / 100) * scale
  }
  if (/^(?:none)$/i.test(t)) return 0
  const v = parseFloat(t)
  return Number.isNaN(v) ? NaN : v
}

function parseFunc(input, name) {
  const m = input.match(new RegExp(`^${name}a?\\(([^)]*)\\)$`))
  if (!m) return null
  const parts = parseNumList(m[1])
  if (parts.length < 3) return null
  return parts
}

/**
 * Parse any supported CSS color string into {r,g,b,a} (0-255, a 0-1).
 * @returns {{r,g,b,a} | null}
 */
export function parseColor(input) {
  if (input == null) return null
  const raw = String(input).trim().toLowerCase()
  if (!raw) return null
  if (NAMED_COLORS[raw]) return hexToRgb(NAMED_COLORS[raw])
  if (raw.startsWith('#')) return hexToRgb(raw)
  if (raw.startsWith('rgb')) {
    const parts = parseFunc(raw, 'rgb')
    if (!parts) return null
    const r = Math.round(clamp(numOrPercent(parts[0]), 0, 255))
    const g = Math.round(clamp(numOrPercent(parts[1]), 0, 255))
    const b = Math.round(clamp(numOrPercent(parts[2]), 0, 255))
    let a = 1
    if (parts.length >= 4) {
      a = clamp(parts[3].endsWith('%') ? numOrPercent(parts[3], 1) : parseFloat(parts[3]), 0, 1)
      if (Number.isNaN(a)) return null
    }
    if ([r, g, b].some(Number.isNaN)) return null
    return { r, g, b, a }
  }
  if (raw.startsWith('hsl')) {
    const parts = parseFunc(raw, 'hsl')
    if (!parts) return null
    let h = parseFloat(parts[0])
    if (parts[0].endsWith('deg')) h = parseFloat(parts[0])
    if (Number.isNaN(h)) return null
    const s = numOrPercent(parts[1], 100)
    const l = numOrPercent(parts[2], 100)
    if (Number.isNaN(s) || Number.isNaN(l)) return null
    let a = 1
    if (parts.length >= 4) {
      a = clamp(parts[3].endsWith('%') ? numOrPercent(parts[3], 1) : parseFloat(parts[3]), 0, 1)
      if (Number.isNaN(a)) return null
    }
    const rgb = hslToRgb(((h % 360) + 360) % 360, clamp(s, 0, 100), clamp(l, 0, 100))
    return { ...rgb, a }
  }
  return null
}

export function rgbToHex({ r, g, b, a = 1 }) {
  const h = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')
  const base = `#${h(r)}${h(g)}${h(b)}`.toUpperCase()
  if (a != null && a < 1) return base + h(a * 255).toUpperCase()
  return base
}

export function rgbToHsl({ r, g, b }) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60
    else if (max === gn) h = ((bn - rn) / d + 2) * 60
    else h = ((rn - gn) / d + 4) * 60
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}

export function hslToRgb(h, s, l) {
  const sn = clamp(s, 0, 100) / 100
  const ln = clamp(l, 0, 100) / 100
  const k = (n) => (n + ((h % 360) + 360) % 360 / 30) % 12
  const a = sn * Math.min(ln, 1 - ln)
  const f = (n) => ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return {
    r: Math.round(f(0) * 255),
    g: Math.round(f(8) * 255),
    b: Math.round(f(4) * 255)
  }
}

export function rgbToHsv({ r, g, b }) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rn) h = (((gn - bn) / d + (gn < bn ? 6 : 0)) * 60)
    else if (max === gn) h = ((bn - rn) / d + 2) * 60
    else h = ((rn - gn) / d + 4) * 60
  }
  return { h: Math.round(h), s: Math.round((max === 0 ? 0 : d / max) * 100), v: Math.round(max * 100) }
}

export function formatRgb({ r, g, b }) {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
}

export function formatRgba({ r, g, b, a = 1 }) {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${round2(a)})`
}

export function formatHsl(color) {
  const { h, s, l } = rgbToHsl(color)
  return `hsl(${h}, ${s}%, ${l}%)`
}

export function formatHsla(color) {
  const { h, s, l } = rgbToHsl(color)
  return `hsla(${h}, ${s}%, ${l}%, ${round2(color.a ?? 1)})`
}

/** WCAG relative luminance. */
export function luminance({ r, g, b }) {
  const lin = (c) => {
    const v = c / 255
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export function contrastRatio(c1, c2) {
  const l1 = luminance(c1)
  const l2 = luminance(c2)
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
  return round2(ratio)
}

export function bestTextColor(bg) {
  return contrastRatio(bg, { r: 255, g: 255, b: 255 }) >= contrastRatio(bg, { r: 0, g: 0, b: 0 })
    ? '#FFFFFF'
    : '#000000'
}

/**
 * 10-step shade scale (like design system 50–900) by adjusting lightness.
 * Returns [{level, hex, rgb}].
 */
export function shadeScale(color) {
  const { h, s } = rgbToHsl(color)
  const lightness = [95, 88, 79, 70, 61, 52, 43, 34, 25, 16]
  return lightness.map((l, i) => {
    const rgb = hslToRgb(h, s, l)
    return { level: (i + 1) * 100, hex: rgbToHex(rgb), rgb }
  })
}

export function withAlpha(color, a) {
  return { ...color, a: clamp(a, 0, 1) }
}
