<script setup>
import { ref, computed } from 'vue'
import ToolShell from '../components/ToolShell.vue'
import CodeArea from '../components/CodeArea.vue'
import CopyButton from '../components/CopyButton.vue'
import Alert from '../components/Alert.vue'
import AppIcon from '../ui/AppIcon.vue'
import { t } from '../utils/i18n'
import { settings } from '../utils/settings'
import {
  formatJson,
  sortJsonKeys,
  escapeJsonString,
  unescapeJsonString,
  jsonStats,
  highlightJson,
  HIGHLIGHT_LIMIT,
  SOFT_LIMIT
} from '../core/json-format'
import { formatBytes } from '../utils/format'

const input = ref('')
const output = ref('')
const outputIsJson = ref(true)
const error = ref(null)
const note = ref('')
const indent = computed({
  get: () => settings.jsonIndent,
  set: (v) => (settings.jsonIndent = v)
})
const stats = ref(null)

const SAMPLE = '{"name":"dev-quick-assistant","version":"1.0.0","local":true,"tags":["json","mv3"],"meta":{"stars":42,"nested":{"deep":[1,2,3]}}}'

const tooBigToHighlight = computed(() => output.value.length > HIGHLIGHT_LIMIT)
const highlighted = computed(() => {
  if (!outputIsJson.value || tooBigToHighlight.value || !output.value) return ''
  try {
    return highlightJson(output.value)
  } catch {
    return ''
  }
})

function reset() {
  output.value = ''
  error.value = null
  note.value = ''
  stats.value = null
}

function onError(err) {
  error.value = err || { message: t('errors.unexpected') }
}

function doFormat() {
  const res = formatJson(input.value, indent.value)
  if (res.ok) {
    output.value = res.result
    outputIsJson.value = true
    error.value = null
    note.value = ''
    stats.value = jsonStats(input.value)
  } else {
    onError(res.error)
  }
}

function doMinify() {
  const res = formatJson(input.value, 'minify')
  if (res.ok) {
    output.value = res.result
    outputIsJson.value = true
    error.value = null
    note.value = ''
  } else onError(res.error)
}

function doValidate() {
  const res = formatJson(input.value, 'minify')
  if (res.ok) {
    error.value = null
    note.value = t('json.valid')
    output.value = ''
  } else {
    onError(res.error)
  }
}

function doSort() {
  const res = sortJsonKeys(input.value)
  if (res.ok) {
    output.value = res.result
    outputIsJson.value = true
    error.value = null
    note.value = t('json.sortDone')
  } else onError(res.error)
}

function doEscape() {
  const res = escapeJsonString(input.value)
  output.value = res.result
  outputIsJson.value = false
  error.value = null
  note.value = t('json.escapeInputHint')
}

function doUnescape() {
  const res = unescapeJsonString(input.value)
  if (res.ok) {
    output.value = typeof res.result === 'string' ? res.result : JSON.stringify(res.result)
    outputIsJson.value = false
    error.value = null
    note.value = res.note ? t('json.unescapeMissingQuotes') : ''
  } else onError(res.error)
}

function loadSample() {
  input.value = SAMPLE
  doFormat()
}

defineExpose({ run: doFormat })
</script>

<template>
  <ToolShell tool-id="json">
    <template #actions>
      <label class="check small">
        {{ t('json.indent') }}
        <select v-model="indent" class="select" style="width: 70px">
          <option value="2">2</option>
          <option value="4">4</option>
          <option value="tab">Tab</option>
        </select>
      </label>
    </template>

    <div class="col">
      <CodeArea
        v-model="input"
        :placeholder="t('json.inputPlaceholder')"
        :rows="7"
        @run="doFormat"
      >
        <template #toolbar>
          <CopyButton v-if="input" :text="input" icon-only />
        </template>
      </CodeArea>

      <div class="toolbar">
        <button class="btn btn-primary" @click="doFormat">
          <AppIcon name="zap" :size="13" /> {{ t('json.format') }}
        </button>
        <button class="btn" @click="doMinify">{{ t('json.minify') }}</button>
        <button class="btn" @click="doValidate">{{ t('json.validate') }}</button>
        <button class="btn" @click="doSort">{{ t('json.sortKeys') }}</button>
        <button class="btn" @click="doEscape">{{ t('json.escape') }}</button>
        <button class="btn" @click="doUnescape">{{ t('json.unescape') }}</button>
        <button class="btn btn-ghost" @click="loadSample">{{ t('common.sample') }}</button>
      </div>

      <Alert v-if="error" type="error">
        <b>{{ t('json.invalid') }}</b>
        <span v-if="error.line"> — {{ t('json.parseErrorAt', { line: error.line, col: error.col }) }}</span>
        <template #details>{{ error.message }}</template>
      </Alert>
      <Alert v-else-if="note" type="success" dense>{{ note }}</Alert>

      <template v-if="output">
        <div class="out-head row">
          <span class="muted tiny">
            {{ t('common.output') }}{{ stats ? ' · ' + t('json.stats', { bytes: formatBytes(stats.bytes), lines: stats.lines, depth: stats.depth }) : '' }}
          </span>
          <span class="spacer" />
          <CopyButton :text="output" :label="t('common.copy')" />
        </div>
        <Alert v-if="tooBigToHighlight" type="warn" dense>
          {{ t('json.tooBig', { size: formatBytes(SOFT_LIMIT) }) }}
        </Alert>
        <pre v-if="highlighted" class="code-block wrap out-block" v-html="highlighted" />
        <pre v-else class="code-block wrap out-block">{{ output }}</pre>
      </template>
      <p v-else-if="!error" class="muted small">{{ t('json.outputPlaceholder') }}</p>
    </div>
  </ToolShell>
</template>

<style scoped>
.out-head { margin-bottom: 4px; }
.out-block { max-height: 320px; }
</style>
