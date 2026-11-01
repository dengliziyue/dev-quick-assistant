/**
 * Package dist/ into release/dev-quick-assistant-v{version}.zip
 * Zero-dependency ZIP writer (deflate via node:zlib).
 */
import { readdirSync, statSync, readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { deflateRawSync } from 'node:zlib'
import { resolve, dirname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = resolve(root, 'dist')
const OUT_DIR = resolve(root, 'release')

/* ---------- crc32 ---------- */
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

/* ---------- zip ---------- */
function dosDateTime(d) {
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() / 2) & 0x1f)
  const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0xf) << 5) | (d.getDate() & 0x1f)
  return { time, date }
}

function createZip(entries) {
  const now = dosDateTime(new Date())
  const locals = []
  const centrals = []
  let offset = 0

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8')
    const crc = crc32(entry.data)
    const compressed = deflateRawSync(entry.data, { level: 9 })
    const useDeflate = compressed.length < entry.data.length

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(0x0800, 6) // UTF-8 names
    local.writeUInt16LE(useDeflate ? 8 : 0, 8)
    local.writeUInt16LE(now.time, 10)
    local.writeUInt16LE(now.date, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(useDeflate ? compressed.length : entry.data.length, 18)
    local.writeUInt32LE(entry.data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)

    locals.push(local, nameBuf, useDeflate ? compressed : entry.data)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4) // version made by
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(useDeflate ? 8 : 0, 10)
    central.writeUInt16LE(now.time, 12)
    central.writeUInt16LE(now.date, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(useDeflate ? compressed.length : entry.data.length, 20)
    central.writeUInt32LE(entry.data.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt32LE(0, 38) // external attrs
    central.writeUInt32LE(offset, 42)
    centrals.push(central, nameBuf)

    offset += local.length + nameBuf.length + (useDeflate ? compressed.length : entry.data.length)
  }

  const cdBuf = Buffer.concat(centrals)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(cdBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)

  return Buffer.concat([...locals, cdBuf, eocd])
}

/* ---------- collect dist files ---------- */
function walk(dir, base = dir) {
  const out = []
  for (const name of readdirSync(dir).sort()) {
    const full = resolve(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full, base))
    else out.push(full)
  }
  return out
}

function main() {
  if (!existsSync(DIST)) {
    console.error('dist/ not found — run `npm run build` first.')
    process.exit(1)
  }
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  const files = walk(DIST)
  const entries = files.map((full) => {
    const arc = relative(DIST, full).split(sep).join('/')
    return { name: `dev-quick-assistant/${arc}`, data: readFileSync(full) }
  })

  mkdirSync(OUT_DIR, { recursive: true })
  const outPath = resolve(OUT_DIR, `dev-quick-assistant-v${pkg.version}.zip`)
  const zip = createZip(entries)
  writeFileSync(outPath, zip)

  const total = entries.reduce((n, e) => n + e.data.length, 0)
  console.log(`✓ packed ${entries.length} files (${(total / 1024).toFixed(1)} KB raw → ${(zip.length / 1024).toFixed(1)} KB zip)`)
  console.log(`  ${outPath}`)
}

main()
