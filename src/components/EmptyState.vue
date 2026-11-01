<script setup>
import AppIcon from '../ui/AppIcon.vue'

defineProps({
  icon: { type: String, default: 'box' },
  text: { type: String, required: true },
  hint: { type: String, default: '' }
})
</script>

<template>
  <div class="empty">
    <AppIcon :name="icon" :size="30" />
    <p class="empty-text">{{ text }}</p>
    <p v-if="hint" class="empty-hint">{{ hint }}</p>
    <div v-if="$slots.default" class="empty-actions">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 28px 14px;
  color: var(--fg-mute);
  text-align: center;
}
.empty-text { font-size: 13px; color: var(--fg-soft); }
.empty-hint { font-size: 11.5px; opacity: 0.85; max-width: 320px; }
.empty-actions { margin-top: 6px; display: flex; gap: 8px; }
</style>
