<script setup>
import AppIcon from '../ui/AppIcon.vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import { TOOLS } from '../utils/tools'
import { t } from '../utils/i18n'
import { getActiveTab } from '../utils/messaging'
import { sessionStore } from '../utils/storage-area'

async function openTool(id) {
  await sessionStore.set({ dqaPendingTool: id }).catch(() => {})
  try {
    const tab = await getActiveTab()
    if (chrome.sidePanel?.open && tab?.id != null) {
      await chrome.sidePanel.open({ tabId: tab.id })
      window.close()
      return
    }
  } catch {
    /* fall through to tab */
  }
  openAsTab(id)
}

async function openAsTab(id) {
  const url = chrome.runtime.getURL('sidepanel.html') + `?tool=${id}&tab=1`
  try {
    await chrome.tabs.create({ url })
    window.close()
  } catch {
    location.href = url
  }
}

function openOptions() {
  const url = chrome.runtime.getURL('options.html')
  chrome.tabs?.create?.({ url })
  window.close()
}
</script>

<template>
  <div class="popup">
    <header class="head">
      <div class="brand row">
        <span class="logo"><AppIcon name="zap" :size="15" /></span>
        <div>
          <h1>Dev Quick Assistant</h1>
          <p class="tiny muted">{{ t('popup.subtitle') }}</p>
        </div>
      </div>
      <div class="row" style="gap: 2px">
        <ThemeToggle />
        <button class="btn btn-ghost btn-icon" :title="t('common.options')" @click="openOptions">
          <AppIcon name="sliders" :size="15" />
        </button>
      </div>
    </header>

    <main class="grid">
      <button v-for="tool in TOOLS" :key="tool.id" class="tool-card" type="button" @click="openTool(tool.id)">
        <span class="tool-icon"><AppIcon :name="tool.icon" :size="17" /></span>
        <span class="tool-name">{{ t(tool.nameKey) }}</span>
        <span class="tool-desc">{{ t(tool.descKey) }}</span>
        <span class="tool-hotkey kbd">Alt+{{ tool.hotkey }}</span>
      </button>
    </main>

    <footer class="foot">
      <span class="tiny muted">{{ t('popup.footerHint') }}</span>
      <span class="spacer" />
      <button class="btn btn-sm" @click="openAsTab('json')">
        <AppIcon name="external" :size="12" /> {{ t('common.openTab') }}
      </button>
    </footer>
  </div>
</template>

<style>
body.page-popup {
  width: 372px;
  height: 560px;
}
</style>

<style scoped>
.popup {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-soft);
}
.brand { gap: 9px; }
.logo {
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 8px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
}
.head h1 { font-size: 13.5px; }
.grid {
  flex: 1;
  overflow: auto;
  padding: 10px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  align-content: start;
}
.tool-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  text-align: left;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-soft);
  cursor: pointer;
  transition: border-color 0.12s ease, transform 0.12s ease, box-shadow 0.12s ease;
}
.tool-card:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow-1);
  transform: translateY(-1px);
}
.tool-icon { color: var(--accent); }
.tool-name { font-size: 12.5px; font-weight: 600; color: var(--fg); }
.tool-desc { font-size: 10.5px; color: var(--fg-mute); }
.tool-hotkey {
  position: absolute;
  top: 8px;
  right: 8px;
  opacity: 0;
  transition: opacity 0.12s ease;
}
.tool-card:hover .tool-hotkey { opacity: 1; }
.foot {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-top: 1px solid var(--border);
  background: var(--bg-soft);
}
</style>
