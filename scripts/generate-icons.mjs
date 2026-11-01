/**
 * Generates extension icons (16/32/48/128 px PNG) with zero dependencies:
 * indigo→violet gradient rounded square + white lightning bolt.
 * Deterministic output, safe to re-run.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateRawSync } from 'node:zlib'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(root, 'public/icons')

/* ---------- crc32 (shared with pack) ---------- */
const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  // compression 0, filter 0, interlace 0
  const raw = Buffer.alloc(height * (width * 4 + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // filter none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const idat = deflateRawSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

/* ---------- drawing ---------- */
const BOLT = [
  [0.55, 0.08],
  [0.30, 0.56],
  [0.47, 0.56],
  [0.42, 0.92],
  [0.71, 0.42],
  [0.52, 0.42]
]

function pointInPolygon(x, y, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function inRoundRect(px, py, S, r) {
  if (px < 0 || py < 0 || px > S || py > S) return false
  const cx = Math.min(Math.max(px, r), S - r)
  const cy = Math.min(Math.max(py, r), S - r)
  const dx = px - cx
  const dy = py - cy
  return dx * dx + dy * dy <= r * r
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function renderIcon(S) {
  const SS = 3 // supersampling factor
  const buf = Buffer.alloc(S * S * 4)
  const gradA = [99, 102, 241] // #6366f1
  const gradB = [139, 92, 246] // #8b5cf6
  const radius = 0.22 * S
  const pad = 0.10 * S // bolt bounding scale

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let coverage = 0
      let bolt = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS
          const py = y + (sy + 0.5) / SS
          if (!inRoundRect(px, py, S, radius)) continue
          coverage++
          const nx = (px - pad) / (S - 2 * pad)
          const ny = (py - pad) / (S - 2 * pad)
          if (pointInPolygon(nx, ny, BOLT)) bolt++
        }
      }
      const total = SS * SS
      const alpha = Math.round((coverage / total) * 255)
      const t = y / (S - 1)
      let r = Math.round(lerp(gradA[0], gradB[0], t))
      let g = Math.round(lerp(gradA[1], gradB[1], t))
      let b = Math.round(lerp(gradA[2], gradB[2], t))
      // blend white bolt with its coverage for smooth edges
      const boltA = coverage ? bolt / coverage : 0
      r = Math.round(lerp(r, 255, boltA))
      g = Math.round(lerp(g, 255, boltA))
      b = Math.round(lerp(b, 255, boltA))
      const idx = (y * S + x) * 4
      buf[idx] = r
      buf[idx + 1] = g
      buf[idx + 2] = b
      buf[idx + 3] = alpha
    }
  }
  return encodePng(S, S, buf)
}

mkdirSync(OUT, { recursive: true })
for (const size of [16, 32, 48, 128]) {
  const png = renderIcon(size)
  writeFileSync(resolve(OUT, `icon${size}.png`), png)
  console.log(`✓ icon${size}.png (${png.length} bytes)`)
}
