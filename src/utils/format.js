/**
 * Small pure formatting helpers.
 */

export function formatBytes(n, digits = 1) {
  if (!Number.isFinite(n) || n < 0) return '0 B'
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let val = n
  let i = -1
  do {
    val /= 1024
    i++
  } while (val >= 1024 && i < units.length - 1)
  return `${val.toFixed(val >= 100 ? 0 : digits)} ${units[i]}`
}

export function truncate(str, max, suffix = '…') {
  if (typeof str !== 'string') return ''
  return str.length <= max ? str : str.slice(0, max) + suffix
}

export function truncateMiddle(str, max = 80) {
  if (typeof str !== 'string' || str.length <= max) return str || ''
  const half = Math.floor((max - 1) / 2)
  return str.slice(0, half) + '…' + str.slice(str.length - half)
}

export function debounce(fn, ms = 200) {
  let timer = null
  function wrapped(...args) {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
  wrapped.cancel = () => clearTimeout(timer)
  return wrapped
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

/** Display value for a diff leaf, truncated for table rendering. */
export function previewValue(value, max = 120) {
  if (value === undefined) return ''
  let s
  try {
    s = typeof value === 'string' ? JSON.stringify(value) : JSON.stringify(value) ?? String(value)
  } catch {
    s = String(value)
  }
  return truncate(s, max)
}

/** Format a duration in ms to human text. */
export function formatDuration(ms) {
  if (!Number.isFinite(ms)) return '-'
  if (ms < 1) return '<1ms'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

/** hh:mm:ss for display of capture time. */
export function formatClock(ts) {
  const d = new Date(ts)
  const p = (x) => String(x).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
