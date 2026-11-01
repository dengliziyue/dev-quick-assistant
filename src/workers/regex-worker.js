/**
 * Regex worker: runs runRegex off the UI thread so catastrophic
 * backtracking can be terminated by timeout instead of freezing the panel.
 */
import { runRegex } from '../core/regex'

self.onmessage = (e) => {
  const { pattern, flags, text, opts } = e.data || {}
  try {
    self.postMessage(runRegex(pattern, flags, text, opts))
  } catch (err) {
    self.postMessage({ ok: false, error: { message: String((err && err.message) || err), stage: 'exec' } })
  }
}
