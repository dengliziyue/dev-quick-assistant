/**
 * Timestamp & date conversion core. Pure functions (Intl based).
 * Unit tested in tests/core/time.test.js
 */

export const TIMEZONES = [
  'UTC',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Australia/Sydney',
  'Pacific/Auckland'
]

/** Extract 10/13-digit timestamps from free text. */
export function extractTimestamps(text) {
  const out = []
  const re = /(?<!\d)(\d{10}|\d{13})(?!\d)/g
  const src = String(text ?? '')
  let m
  while ((m = re.exec(src)) !== null) {
    const raw = m[1]
    out.push({ raw, unit: raw.length === 13 ? 'ms' : 's', ms: raw.length === 13 ? Number(raw) : Number(raw) * 1000 })
    if (m.index === re.lastIndex) re.lastIndex++
  }
  return out
}

/** Normalize a timestamp to milliseconds. */
export function tsToMs(value, unit = 'auto') {
  if (value == null) return null
  const str = typeof value === 'number' ? null : String(value).trim()
  if (str !== null && str === '') return null
  const num = typeof value === 'number' ? value : Number(str)
  if (!Number.isFinite(num)) return null
  if (unit === 's') return num * 1000
  if (unit === 'ms') return num
  const digits = Math.abs(Math.trunc(num)).toString().length
  if (digits <= 10) return num * 1000
  if (digits === 13) return num
  if (digits > 10 && digits < 13) return num * 1000 // e.g. 11-12 digit seconds-ish, treat as ms? keep ms
  return num // 13+ digits: assume ms
}

/** Format parts of a date inside an IANA timezone (h23 hours). */
export function datePartsInTz(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short'
  })
  const parts = {}
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: parts.weekday
  }
}

/** Offset of a timezone at a given instant, in ms (UTC - tz). */
export function tzOffsetMs(date, timeZone) {
  const p = datePartsInTz(date, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

const pad = (n, w = 2) => String(n).padStart(w, '0')

/** Pattern formatter inside a timezone: yyyy MM dd HH mm ss SSS. */
export function formatInTz(date, timeZone, pattern = 'yyyy-MM-dd HH:mm:ss') {
  const p = datePartsInTz(date, timeZone)
  const map = {
    yyyy: String(p.year).padStart(4, '0'),
    yy: String(p.year).slice(-2),
    MM: pad(p.month),
    M: String(p.month),
    dd: pad(p.day),
    d: String(p.day),
    HH: pad(p.hour),
    H: String(p.hour),
    mm: pad(p.minute),
    m: String(p.minute),
    ss: pad(p.second),
    s: String(p.second),
    SSS: pad(date.getMilliseconds(), 3),
    EEE: p.weekday
  }
  return pattern.replace(/yyyy|yy|MMM|MM|EEE|dd|HH|mm|ss|SSS|M|d|H|m|s/g, (tok) =>
    map[tok] != null ? map[tok] : tok
  )
}

export function formatIso(date) {
  return date.toISOString()
}

export function formatLocale(date, timeZone) {
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone, dateStyle: 'medium', timeStyle: 'medium' }).format(date)
  } catch {
    return date.toString()
  }
}

/** Interpret a wall-clock time in a timezone as a UTC instant (two-pass). */
export function zonedTimeToUtc(year, month, day, hour, minute, second, timeZone) {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second)
  const off1 = tzOffsetMs(new Date(guess), timeZone)
  let t = guess - off1
  const off2 = tzOffsetMs(new Date(t), timeZone)
  if (off2 !== off1) t = guess - off2
  return t
}

/**
 * Parse human date input. Supports:
 *  - 'yyyy-MM-dd[ HH:mm[:ss]]' / 'yyyy/MM/dd…'  (interpreted in `timeZone`)
 *  - anything Date.parse understands (ISO 8601 etc.)
 * @returns {{ok:true, date:Date} | {ok:false, error:string}}
 */
export function parseDateInput(str, timeZone = 'local') {
  const raw = String(str ?? '').trim()
  if (!raw) return { ok: false, error: 'empty' }
  const m = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (m) {
    const [, y, mo, d, h = '0', mi = '0', s = '0'] = m
    const year = +y
    const month = +mo
    const day = +d
    const hour = +h
    const minute = +mi
    const second = +s
    if (month < 1 || month > 12 || day < 1 || day > 31) return { ok: false, error: 'range' }
    const ms =
      !timeZone || timeZone === 'local'
        ? new Date(year, month - 1, day, hour, minute, second).getTime()
        : zonedTimeToUtc(year, month, day, hour, minute, second, timeZone)
    if (!Number.isFinite(ms)) return { ok: false, error: 'range' }
    return { ok: true, date: new Date(ms) }
  }
  const parsed = Date.parse(raw)
  if (Number.isNaN(parsed)) return { ok: false, error: 'invalid' }
  const date = new Date(parsed)
  if (Math.abs(date.getTime()) > 8.64e15) return { ok: false, error: 'range' }
  return { ok: true, date }
}

/** Relative time info for rendering. */
export function relativeInfo(ms) {
  const diff = Math.abs(ms)
  const future = ms > 0
  if (diff < 45_000) return { now: true, unit: 'unitSecond', n: 0, future }
  const steps = [
    [3_600_000, 'unitMinute', 60_000],
    [86_400_000, 'unitHour', 3_600_000],
    [604_800_000, 'unitDay', 86_400_000],
    [2_592_000_000, 'unitWeek', 604_800_000],
    [31_536_000_000, 'unitMonth', 2_592_000_000],
    [Infinity, 'unitYear', 31_536_000_000]
  ]
  for (const [limit, unit, size] of steps) {
    if (diff < limit) return { now: false, unit, n: Math.round(diff / size), future }
  }
  return { now: false, unit: 'unitYear', n: 0, future }
}
