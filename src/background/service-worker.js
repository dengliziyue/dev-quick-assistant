/**
 * MV3 service worker (module type). Minimal on purpose:
 * - seeds default settings on install
 * - opens the side panel on the Alt+Shift+S command
 * No analytics, no remote calls, no persistent listeners that hold state.
 */

const DEFAULTS = {
  theme: 'auto',
  locale: 'auto',
  jsonIndent: '2',
  reqBufferSize: 200,
  imageThumbs: true
}

chrome.runtime.onInstalled.addListener(async () => {
  try {
    const stored = await chrome.storage.sync.get(Object.keys(DEFAULTS))
    const patch = {}
    for (const [k, v] of Object.entries(DEFAULTS)) {
      if (stored[k] == null) patch[k] = v
    }
    if (Object.keys(patch).length) await chrome.storage.sync.set(patch)
  } catch {
    /* storage unavailable */
  }
})

// Keep popup as the action-click default (side panel opens via command or popup button).
try {
  chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {})
} catch {
  /* older Chrome */
}

chrome.commands?.onCommand?.addListener(async (command) => {
  if (command !== 'open-side-panel') return
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
    if (!tab?.id) return
    await chrome.sidePanel.open({ tabId: tab.id })
  } catch (e) {
    // chrome:// pages etc. cannot host the side panel; ignore quietly
    console.debug('[dqa] open-side-panel failed:', e?.message)
  }
})
