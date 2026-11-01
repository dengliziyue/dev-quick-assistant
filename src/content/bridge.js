/**
 * ISOLATED-world bridge content script.
 * Relays "get captured requests" queries from the popup/side panel to the
 * MAIN-world hook via window CustomEvents. Fully local, nothing leaves the tab.
 *
 * Runtime message contract:
 *   { type: 'DQA_GET_REQUESTS' }
 *     -> { ok: true, requests: [...], pageUrl }
 *     -> { ok: false, code: 'NO_HOOK' | 'TIMEOUT' }
 */
;(function () {
  'use strict'

  function queryHook(timeoutMs) {
    return new Promise((resolve) => {
      const nonce = 'dqa-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
      let settled = false

      function onReply(ev) {
        try {
          const detail = ev && ev.detail
          if (!detail || detail.nonce !== nonce || settled) return
          settled = true
          clearTimeout(timer)
          window.removeEventListener('DQA_REQ_DATA', onReply)
          resolve(detail.payload)
        } catch {
          /* ignore */
        }
      }

      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        window.removeEventListener('DQA_REQ_DATA', onReply)
        resolve(null)
      }, timeoutMs)

      window.addEventListener('DQA_REQ_DATA', onReply)
      try {
        window.dispatchEvent(new CustomEvent('DQA_REQ_QUERY', { detail: { nonce } }))
      } catch {
        clearTimeout(timer)
        window.removeEventListener('DQA_REQ_DATA', onReply)
        resolve(null)
      }
    })
  }

  if (chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (!msg || msg.type !== 'DQA_GET_REQUESTS') return undefined
      queryHook(msg.timeout ?? 600).then((payload) => {
        if (payload) {
          sendResponse({ ok: true, requests: payload.requests || [], pageUrl: payload.pageUrl })
        } else {
          sendResponse({ ok: false, code: 'NO_HOOK' })
        }
      })
      return true // async sendResponse
    })
  }
})()
