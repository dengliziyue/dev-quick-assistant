/**
 * Tab & page messaging helpers.
 * All page interactions run through chrome.scripting / chrome.tabs —
 * everything stays inside the browser, nothing is sent anywhere.
 */

export async function getActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
    if (tab) return tab
    const [fallback] = await chrome.tabs.query({ active: true, currentWindow: true })
    return fallback
  } catch {
    return null
  }
}

export function isHttpUrl(url) {
  return /^https?:\/\//i.test(url || '')
}

/** chrome.tabs.sendMessage with timeout; rejects with Error on failure. */
export function sendTabMessage(tabId, message, timeoutMs = 800) {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error('TIMEOUT'))
    }, timeoutMs)
    try {
      chrome.tabs.sendMessage(tabId, message, (res) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        const err = chrome.runtime.lastError
        if (err) reject(new Error(err.message || 'NO_RECEIVER'))
        else resolve(res)
      })
    } catch (e) {
      settled = true
      clearTimeout(timer)
      reject(e)
    }
  })
}

/**
 * Ask the content-script bridge for the request ring buffer of a tab.
 * Returns { ok, requests?, pageUrl?, code? } — code explains failures.
 */
export async function getCapturedRequests(tabId) {
  try {
    const res = await sendTabMessage(tabId, { type: 'DQA_GET_REQUESTS' }, 1000)
    if (res && typeof res === 'object') return res
    return { ok: false, code: 'NO_HOOK' }
  } catch {
    return { ok: false, code: 'NO_HOOK' }
  }
}

/**
 * Execute a standalone function in the tab. The function is serialized,
 * so it must not close over anything. Returns result of the first frame.
 */
export async function execOnTab(tabId, func, args = [], world = 'ISOLATED') {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func,
    args,
    world
  })
  return results?.[0]?.result
}

/** Injected collectors can throw raw errors; normalize to friendly codes. */
export function mapExecError(e) {
  const msg = String(e?.message || e || '')
  if (/cannot be scripted|browser internal|chrome-extension|chrome:\/\//i.test(msg)) {
    return 'PAGE_UNAVAILABLE'
  }
  if (/No tab with id|tab was closed/i.test(msg)) return 'NO_TAB'
  return 'EXEC_FAIL'
}
