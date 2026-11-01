<script setup>
defineProps({
  type: { type: String, default: 'info' }, // error | warn | info | success
  dense: { type: Boolean, default: false }
})

const ICONS = { error: 'alert', warn: 'alert', info: 'info', success: 'check' }
</script>

<template>
  <div class="alert" :class="[type, { dense }]" role="alert">
    <slot name="icon">
      <AppIcon :name="ICONS[type] || 'info'" :size="14" />
    </slot>
    <div class="alert-body">
      <slot />
      <details v-if="$slots.details" class="alert-details">
        <summary>details</summary>
        <div class="alert-details-body"><slot name="details" /></div>
      </details>
    </div>
  </div>
</template>

<style scoped>
.alert {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 9px 11px;
  border-radius: var(--radius-sm);
  font-size: 12.5px;
  border: 1px solid transparent;
  word-break: break-word;
}
.alert.error { background: var(--danger-soft); color: var(--danger); }
.alert.warn { background: var(--warn-soft); color: var(--warn); }
.alert.info { background: var(--info-soft); color: var(--info); }
.alert.success { background: var(--ok-soft); color: var(--ok); }
.alert.dense { padding: 5px 9px; }
.alert :deep(svg) { flex: none; margin-top: 1px; }
.alert-body { min-width: 0; flex: 1; }
.alert-details summary {
  cursor: pointer;
  font-size: 11.5px;
  opacity: 0.8;
  user-select: none;
  margin-top: 3px;
}
.alert-details-body {
  font-family: var(--font-mono);
  font-size: 11.5px;
  margin-top: 4px;
  white-space: pre-wrap;
  word-break: break-all;
  opacity: 0.9;
}
</style>
