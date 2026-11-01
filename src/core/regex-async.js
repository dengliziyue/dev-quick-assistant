/**
 * Run the regex in a Worker when available (extension pages & browsers),
 * with a hard timeout + terminate. Falls back to sync execution in
 * environments without Worker (unit tests, very old hosts).
 */
import { runRegex } from './regex'

export function runRegexAsync(pattern, flags, text, opts = {}, timeoutMs = 3000) {
  if (typeof Worker === 'undefined') {
    return Promise.resolve(runRegex(pattern, flags, text, opts))
  }
  return new Promise((resolve) => {
    let worker
    try {
      worker = new Worker(new URL('../workers/regex-worker.js', import.meta.url), { type: 'module' })
    } catch {
      resolve(runRegex(pattern, flags, text, opts))
      return
    }
    let settled = false
    const finish = (res) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        worker.terminate()
      } catch {
        /* already gone */
      }
      resolve(res)
    }
    const timer = setTimeout(
      () => finish({ ok: false, error: { message: 'timeout', stage: 'exec' } }),
      timeoutMs
    )
    worker.onmessage = (e) => finish(e.data)
    worker.onerror = (e) =>
      finish({ ok: false, error: { message: e?.message || 'worker error', stage: 'exec' } })
    worker.postMessage({ pattern, flags, text, opts })
  })
}
