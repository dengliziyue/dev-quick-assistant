/**
 * Preview harness entry (dev only, served by `npm run dev` at /preview.html).
 * Installs the chrome mock, seeds a demo "page" into this document, and mounts
 * the popup or side panel app into a device frame so every tool can be
 * developed and screenshotted without loading the extension.
 */
import { createApp } from 'vue'
import { installChromeMock } from './chrome-mock'
import { initSettings, settings, resolvedTheme } from '../utils/settings'
import PopupApp from '../popup/App.vue'
import SidepanelApp from '../sidepanel/App.vue'
import '../styles/theme.css'

installChromeMock()

/* the template's mount div (styled height:100%) would fight the harness frame */
document.getElementById('app')?.remove()

/* ---------- seed demo "web page" data into this document ---------- */
function svgDataUrl(color, label) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='120'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${color}'/><stop offset='1' stop-color='#1e293b'/></linearGradient></defs><rect width='100%' height='100%' fill='url(%23g)'/><text x='12' y='66' fill='rgba(255,255,255,.9)' font-family='monospace' font-size='16'>${label}</text></svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

function seedDemoPage() {
  if (document.getElementById('dqa-demo-seed')) return
  const holder = document.createElement('div')
  holder.id = 'dqa-demo-seed'
  holder.style.display = 'none'

  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#84cc16']
  colors.forEach((c, i) => {
    const img = document.createElement('img')
    img.src = svgDataUrl(c, 'banner-' + (i + 1) + '.svg')
    img.alt = 'demo image ' + (i + 1)
    holder.appendChild(img)
  })

  const bgDiv = document.createElement('div')
  bgDiv.style.backgroundImage = `url("${svgDataUrl('#0ea5e9', 'css-bg.svg')}")`
  holder.appendChild(bgDiv)

  const iconLink = document.createElement('link')
  iconLink.rel = 'icon'
  iconLink.href = svgDataUrl('#111827', 'icon')
  document.head.appendChild(iconLink)

  document.body.appendChild(holder)

  if (!localStorage.getItem('demo.seeded')) {
    localStorage.setItem('demo.user', JSON.stringify({ id: 42, name: 'dev', roles: ['admin', 'editor'] }))
    localStorage.setItem('demo.feature_flags', '{"new_checkout":true,"beta_panel":false}')
    localStorage.setItem('demo.last_route', '/dashboard/overview?tab=main')
    localStorage.setItem('demo.big_value', 'x'.repeat(3000))
    sessionStorage.setItem('demo.token', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MiJ9.sig')
    sessionStorage.setItem('demo.scroll_pos', '1280')
    localStorage.setItem('demo.seeded', '1')
  }
}
seedDemoPage()

/* ---------- toolbar + frame ---------- */
document.title = 'DQA Preview Harness'

const toolbar = document.createElement('div')
toolbar.innerHTML = `
  <div id="dqa-toolbar">
    <strong>Dev Quick Assistant</strong><span class="muted">preview harness (dev only)</span>
    <span class="sep"></span>
    <button data-view="popup">Popup</button>
    <button data-view="panel">Side Panel</button>
    <button data-view="tab">Tab View</button>
    <span class="sep"></span>
    <span class="muted" id="dqa-hint">Alt+1…0 切换工具 · Ctrl+Enter 运行</span>
    <span class="spacer"></span>
    <button data-theme>🌗 Theme: <b id="dqa-theme-name"></b></button>
  </div>
`
document.body.prepend(toolbar)

const style = document.createElement('style')
style.textContent = `
  body.page-preview { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
  #dqa-demo-seed { display: none; }
  #dqa-toolbar {
    display: flex; align-items: center; gap: 8px; padding: 7px 12px;
    border-bottom: 1px solid var(--border); background: var(--bg-soft);
    font-size: 12.5px; flex: none; z-index: 10;
  }
  #dqa-toolbar .sep { width: 1px; height: 16px; background: var(--border-strong); }
  #dqa-toolbar .spacer { flex: 1; }
  #dqa-toolbar button {
    padding: 3px 10px; border: 1px solid var(--border-strong); border-radius: 6px;
    background: var(--bg-soft); color: var(--fg); cursor: pointer; font-size: 12px;
  }
  #dqa-toolbar button.active { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
  #dqa-frame-wrap { flex: 1; display: flex; justify-content: center; overflow: hidden; background: var(--bg-inset); }
  #dqa-frame { background: var(--bg); }
  .view-popup #dqa-frame {
    width: 372px; height: 560px; margin: 24px 0;
    border: 1px solid var(--border-strong); border-radius: 12px; overflow: hidden;
    box-shadow: var(--shadow-2);
  }
  .view-panel #dqa-frame-wrap { justify-content: flex-end; }
  .view-panel #dqa-frame {
    width: 400px; height: 100%; border-left: 1px solid var(--border-strong);
    box-shadow: var(--shadow-2);
  }
  .view-tab #dqa-frame { width: 100%; height: 100%; }
  #frame-root { height: 100%; }
`
document.head.appendChild(style)

const frameWrap = document.createElement('div')
frameWrap.id = 'dqa-frame-wrap'
frameWrap.innerHTML = '<div id="dqa-frame"><div id="frame-root"></div></div>'
document.body.appendChild(frameWrap)

let app = null
let view = 'panel'

function setThemeLabel() {
  const el = document.getElementById('dqa-theme-name')
  if (el) el.textContent = settings.theme === 'auto' ? `auto (${resolvedTheme()})` : settings.theme
  document.querySelectorAll('#dqa-toolbar [data-theme]').forEach((b) => {
    /* noop */
  })
}

function render() {
  if (app) app.unmount()
  document.body.className = 'page-preview'
  document.body.classList.add('view-' + (view === 'panel' ? 'panel' : view))
  document.querySelectorAll('#dqa-toolbar [data-view]').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === view)
  })
  const root = document.getElementById('frame-root')
  root.innerHTML = ''
  app = createApp(view === 'popup' ? PopupApp : SidepanelApp)
  app.mount(root)
  setThemeLabel()
}

toolbar.addEventListener('click', (e) => {
  const btn = e.target.closest('button')
  if (!btn) return
  if (btn.dataset.view) {
    view = btn.dataset.view
    render()
  } else if (btn.hasAttribute('data-theme')) {
    settings.theme = resolvedTheme() === 'dark' ? 'light' : 'dark'
    setThemeLabel()
  }
})

/* react to mocked chrome calls (popup -> side panel / tab handoff) */
window.addEventListener('dqa-preview', (e) => {
  const { type, tool } = e.detail || {}
  if (type === 'openPanel') {
    view = 'panel'
    render()
  } else if (type === 'openTab') {
    view = 'tab'
    render()
    if (tool) {
      const sel = window.sessionStorage.getItem('dqa:dqaPendingTool')
      /* SidepanelApp reads dqaPendingTool on mount — re-mount handled by render() */
    }
  }
})

/* boot */
initSettings()
  .catch(() => {})
  .finally(() => {
    const params = new URLSearchParams(location.search)
    const v = params.get('view')
    if (v === 'popup' || v === 'panel' || v === 'tab') view = v
    render()
  })
