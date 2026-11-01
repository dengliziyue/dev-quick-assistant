/**
 * Clipboard + file download helpers (extension pages are secure contexts).
 */

export async function copyText(text) {
  if (typeof text !== 'string') text = String(text ?? '')
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

/** Download generated text via an object URL + anchor. */
export function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Download a remote/data URL. Uses chrome.downloads when available
 * (works for cross-origin without leaving the panel), falls back to anchor.
 */
export function downloadFile(url, filename) {
  try {
    if (typeof chrome !== 'undefined' && chrome?.downloads?.download) {
      return chrome.downloads.download({ url, filename, saveAs: false })
    }
  } catch {
    /* fall through */
  }
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.target = '_blank'
  a.rel = 'noopener'
  a.click()
}
