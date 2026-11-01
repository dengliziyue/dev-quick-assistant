<script setup>
import { computed } from 'vue'
import { t } from '../utils/i18n'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  rows: { type: [Number, String], default: 8 },
  code: { type: Boolean, default: true },
  disabled: { type: Boolean, default: false },
  /** show char/byte footer */
  stats: { type: Boolean, default: true },
  spellcheck: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])

const CHARS = computed(() => props.modelValue.length)
const BYTES = computed(() => {
  try {
    if (props.modelValue.length > 500_000) return `≈${props.modelValue.length}`
    return new TextEncoder().encode(props.modelValue).length
  } catch {
    return props.modelValue.length
  }
})

function onInput(e) {
  emit('update:modelValue', e.target.value)
}
function onClear() {
  emit('update:modelValue', '')
}
function onKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    emit('run')
  }
}
</script>

<template>
  <div class="code-area">
    <div class="code-area-box">
      <textarea
        class="textarea code"
        :class="{ plain: !code }"
        :value="modelValue"
        :placeholder="placeholder"
        :rows="rows"
        :disabled="disabled"
        :spellcheck="spellcheck"
        @input="onInput"
        @keydown="onKeydown"
      />
      <div v-if="$slots.toolbar" class="code-area-toolbar">
        <slot name="toolbar" />
      </div>
    </div>
    <div v-if="stats" class="code-area-foot muted tiny">
      <span>{{ CHARS }} {{ t('common.chars') }} · {{ BYTES }} {{ t('common.bytes') }}</span>
      <span class="spacer" />
      <button class="btn btn-ghost btn-sm" type="button" @click="onClear">{{ t('common.clear') }}</button>
    </div>
  </div>
</template>

<style scoped>
.code-area { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.code-area-box { position: relative; min-width: 0; }
.textarea { width: 100%; }
.textarea.code {
  resize: vertical;
  white-space: pre;
  overflow-wrap: normal;
  overflow-x: auto;
  tab-size: 2;
}
.textarea.code.plain {
  white-space: pre-wrap;
  word-break: break-all;
}
.code-area-toolbar {
  position: absolute;
  top: 6px;
  right: 8px;
  display: flex;
  gap: 6px;
}
.code-area-foot { display: flex; align-items: center; }
</style>
