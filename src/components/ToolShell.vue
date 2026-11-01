<script setup>
import AppIcon from '../ui/AppIcon.vue'
import { getTool } from '../utils/tools'
import { t } from '../utils/i18n'

const props = defineProps({
  toolId: { type: String, required: true }
})
const tool = getTool(props.toolId)
</script>

<template>
  <div class="tool-shell">
    <header class="tool-shell-head">
      <AppIcon :name="tool?.icon || 'zap'" :size="17" class="tool-shell-icon" />
      <div class="grow">
        <h2 class="tool-shell-title">{{ tool ? t(tool.nameKey) : toolId }}</h2>
        <p v-if="tool" class="tool-shell-desc muted tiny">{{ t(tool.descKey) }}</p>
      </div>
      <div class="toolbar">
        <slot name="actions" />
      </div>
    </header>
    <div class="tool-shell-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.tool-shell { display: flex; flex-direction: column; height: 100%; min-width: 0; }
.tool-shell-head {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-soft);
  flex: none;
}
.tool-shell-icon { color: var(--accent); flex: none; }
.tool-shell-title { font-size: 14px; }
.tool-shell-body { flex: 1; overflow: auto; padding: 12px; min-height: 0; }
</style>
