<script setup>
import { ref, computed } from 'vue'
import ToolShell from '../components/ToolShell.vue'
import CodeArea from '../components/CodeArea.vue'
import Alert from '../components/Alert.vue'
import AppIcon from '../ui/AppIcon.vue'
import { t } from '../utils/i18n'
import { encodeBase64, decodeBase64, encodeUrl, decodeUrl } from '../core/base64'

const mode = ref('base64') // 'base64' | 'url'
const input = ref('')
const output = ref('')
const error = ref('')
const urlSafe = ref(false)
const lastAction = ref('') // 'encode' | 'decode'

const algoName = computed(() => (mode.value === 'base64' ? 'Base64' : 'URL'))

function doEncode() {
  error.value = ''
  const res = mode.value === 'base64' ? encodeBase64(input.value, { urlSafe: urlSafe.value }) : encodeUrl(input.value)
  output.value = res.result
  lastAction.value = 'encode'
}

function doDecode() {
  error.value = ''
  const res = mode.value === 'base64' ? decodeBase64(input.value) : decodeUrl(input.value)
  if (res.ok) {
    output.value = res.result
    lastAction.value = 'decode'
  } else {
    output.value = ''
    error.value = t('base64.decodeFail', { algo: algoName.value }) + (res.error?.message ? ` [${res.error.message}]` : '')
  }
}

function swap() {
  const prev = input.value
  input.value = output.value
  output.value = prev
  error.value = ''
}

function switchMode(m) {
  mode.value = m
  error.value = ''
}

defineExpose({ run: doEncode })
</script>

<template>
  <ToolShell tool-id="base64">
    <template #actions>
      <div class="row" style="gap: 4px">
        <button class="btn btn-sm" :class="{ 'btn-primary': mode === 'base64' }" @click="switchMode('base64')">
          {{ t('base64.mBase64') }}
        </button>
        <button class="btn btn-sm" :class="{ 'btn-primary': mode === 'url' }" @click="switchMode('url')">
          {{ t('base64.mUrl') }}
        </button>
      </div>
    </template>

    <div class="col">
      <label v-if="mode === 'base64'" class="check small">
        <input v-model="urlSafe" type="checkbox" />
        {{ t('base64.urlSafe') }}
      </label>

      <CodeArea
        v-model="input"
        :rows="6"
        :placeholder="lastAction === 'decode' || mode === 'base64' ? t('base64.inputPlaceholder') : t('base64.inputPlaceholder')"
      >
        <template #toolbar>
          <CopyButton v-if="input" :text="input" icon-only />
        </template>
      </CodeArea>

      <div class="toolbar">
        <button class="btn btn-primary" @click="doEncode">
          <AppIcon name="download" :size="13" /> {{ t('base64.encode') }}
        </button>
        <button class="btn" @click="doDecode">{{ t('base64.decode') }}</button>
        <button class="btn btn-ghost" @click="swap">
          <AppIcon name="swap" :size="13" /> {{ t('base64.swap') }}
        </button>
      </div>

      <Alert v-if="error" type="error" dense>{{ error }}</Alert>

      <CodeArea v-model="output" :rows="6" :placeholder="t('common.output')" :disabled="true">
        <template #toolbar>
          <CopyButton v-if="output" :text="output" icon-only />
        </template>
      </CodeArea>

      <p class="muted tiny">{{ t('base64.note') }}</p>
    </div>
  </ToolShell>
</template>
