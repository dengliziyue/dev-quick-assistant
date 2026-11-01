<script setup>
import { ref, computed, onMounted, onBeforeUnmount, defineAsyncComponent } from 'vue'
import AppIcon from '../ui/AppIcon.vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import { TOOLS, loadToolComponent } from '../utils/tools'
import { t } from '../utils/i18n'
import { sessionStore } from '../utils/storage-area'

const active = ref('json')
const comps = Object.fromEntries(
  TOOLS.map((tool) => [tool.id, defineAsyncComponent(() => loadToolComponent(tool.id))])
)
const activeTool = computed(() => TOOLS.find((tool) => tool.id === active.value))
const activeComp = computed(() => comps[active.value])

/** opened as a full tab (?tab=1) -> wider rail with labels */
const isTab = ref(new URLSearchParams(location.search).has('tab'))

function setActive(id) {
  active.value = id
  history.replaceState(null, '', isTab.value ? `?tool=${id}&tab=1` : '?panel=1')
}

function openOptions() {
  const url = chrome.runtime.getURL('options.html')
  chrome.tabs?.create?.({ url })
}

onMounted(async () => {
  // popup handoff: session storage takes priority, then URL param
  try {
    const { dqaPendingTool } = await sessionStore.get(['dqaPendingTool'])
    if (dqaPendingTool) {
      setActive(dqaPendingTool)
      await sessionStore.remove('dqaPendingTool')
      return
    }
  } catch {
    /* ignore */
  }
  const fromUrl = new URLSearchParams(location.search).get('tool')
  if (fromUrl && TOOLS.some((tool) => tool.id === fromUrl)) active.value = fromUrl
})

/* in-app shortcuts: Alt+1..9/0 switch tools, Alt+Arrow cycles */
function onKeydown(e) {
  if (!e.altKey || e.ctrlKey || e.metaKey) return
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    const idx = TOOLS.findIndex((tool) => tool.id === active.value)
    const delta = e.key === 'ArrowDown' ? 1 : -1
    active.value = TOOLS[(idx + delta + TOOLS.length) % TOOLS.length].id
    return
  }
  const tool = TOOLS.find((tool) => tool.hotkey === e.key)
  if (tool) {
    e.preventDefault()
    active.value = tool.id
  }
}
window.addEventListener('keydown', onKeydown)
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="shell" :class="{ tab: isTab }">
    <nav class="rail">
      <span class="rail-logo"><AppIcon name="zap" :size="16" /></span>
      <button
        v-for="tool in TOOLS"
        :key="tool.id"
        class="rail-btn"
        :class="{ active: tool.id === active }"
        :title="t(tool.nameKey) + (isTab ? '' : ` (Alt+${tool.hotkey})`)"
        type="button"
        @click="setActive(tool.id)"
      >
        <AppIcon :name="tool.icon" :size="16" />
        <span v-if="isTab" class="rail-label">{{ t(tool.nameKey) }}</span>
      </button>
      <span class="spacer" />
      <ThemeToggle />
      <button class="rail-btn" :title="t('common.options')" type="button" @click="openOptions">
        <AppIcon name="sliders" :size="16" />
      </button>
    </nav>
    <main class="content">
      <KeepAlive>
        <component :is="activeComp" :key="active" />
      </KeepAlive>
    </main>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  height: 100%;
  min-width: 0;
}
.rail {
  width: 46px;
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 0;
  border-right: 1px solid var(--border);
  background: var(--bg-soft);
}
.rail-logo {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  margin-bottom: 6px;
  flex: none;
}
.rail-btn {
  position: relative;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--fg-mute);
  cursor: pointer;
}
.rail-btn:hover { background: var(--bg-hover); color: var(--fg); }
.rail-btn.active { background: var(--accent-soft); color: var(--accent); }
.rail-btn.active::before {
  content: '';
  position: absolute;
  left: -6px;
  width: 3px;
  height: 16px;
  border-radius: 2px;
  background: var(--accent);
}
.content { flex: 1; min-width: 0; overflow: hidden; }

/* full tab layout: labeled sidebar */
.shell.tab .rail {
  width: 172px;
  align-items: stretch;
  padding: 10px 8px;
}
.shell.tab .rail-btn {
  width: 100%;
  justify-content: flex-start;
  padding: 0 10px;
  height: 32px;
}
.shell.tab .rail-btn.active::before { left: -8px; }
.rail-label { font-size: 12px; }
@media (min-width: 760px) {
  .shell:not(.tab) .rail { width: 46px; }
}
</style>
