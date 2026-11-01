<script setup>
import { ref, computed } from 'vue'
import AppIcon from '../ui/AppIcon.vue'
import { copyText } from '../utils/clipboard'
import { t } from '../utils/i18n'

const props = defineProps({
  /** string or getter */
  text: { type: [String, Function], required: true },
  label: { type: String, default: '' },
  iconOnly: { type: Boolean, default: false },
  primary: { type: Boolean, default: false },
  title: { type: String, default: '' }
})

const copied = ref(false)
let timer = null
const state = computed(() => (copied.value ? 'check' : 'copy'))

async function onClick() {
  const value = typeof props.text === 'function' ? props.text() : props.text
  const ok = await copyText(value ?? '')
  copied.value = ok
  clearTimeout(timer)
  timer = setTimeout(() => (copied.value = false), 1400)
}
</script>

<template>
  <button
    class="btn btn-sm"
    :class="{ 'btn-primary': primary && !copied }"
    :title="title || t('common.copy')"
    type="button"
    @click="onClick"
  >
    <AppIcon :name="state" :size="13" />
    <span v-if="!iconOnly">{{ copied ? t('common.copied') : label || t('common.copy') }}</span>
  </button>
</template>
