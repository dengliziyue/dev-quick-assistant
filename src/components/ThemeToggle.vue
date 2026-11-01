<script setup>
import { computed } from 'vue'
import AppIcon from '../ui/AppIcon.vue'
import { settings, resolvedTheme } from '../utils/settings'
import { t } from '../utils/i18n'

const icon = computed(() => (resolvedTheme() === 'dark' ? 'sun' : 'moon'))

function cycle() {
  // toggle between light/dark explicitly (auto users get a concrete theme)
  settings.theme = resolvedTheme() === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <button class="btn btn-ghost btn-icon" :title="t('common.theme')" type="button" @click="cycle">
    <AppIcon :name="icon" :size="15" />
  </button>
</template>
