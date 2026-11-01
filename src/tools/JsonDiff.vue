<script setup>
import { ref, computed, watch } from 'vue'
import ToolShell from '../components/ToolShell.vue'
import Alert from '../components/Alert.vue'
import EmptyState from '../components/EmptyState.vue'
import { t } from '../utils/i18n'
import { diffJson, lineDiff } from '../core/json-diff'
import { formatJson } from '../core/json-format'
import { previewValue, debounce } from '../utils/format'
import { copyText } from '../utils/clipboard'

const left = ref('')
const right = ref('')
const auto = ref(true)
const result = ref(null)
const view = ref('list') // 'list' | 'lines'
const copiedPath = ref('')

const LINE_DIFF_LIMIT = 3000

const prettyLeft = ref([])
const prettyRight = ref([])
const lines = ref([])
const linesNote = ref('')

function run() {
  const res = diffJson(left.value, right.value)
  result.value = res
  lines.value = []
  linesNote.value = ''
  if (!res.ok) return
  try {
    const fmt = (text) => (formatJson(text, '2').ok ? formatJson(text, '2').result : String(text))
    const aText = fmt(left.value || 'null')
    const bText = fmt(right.value || 'null')
    prettyLeft.value = aText.split('\n')
    prettyRight.value = bText.split('\n')
    if (prettyLeft.value.length <= LINE_DIFF_LIMIT && prettyRight.value.length <= LINE_DIFF_LIMIT) {
      lines.value = lineDiff(prettyLeft.value, prettyRight.value)
    } else {
      linesNote.value = t('json.tooBig', { size: `${LINE_DIFF_LIMIT} ${t('common.lines')}` })
      lines.value = []
    }
  } catch {
    lines.value = []
  }
}

const debouncedRun = debounce(run, 400)
watch([left, right], () => {
  if (auto.value) debouncedRun()
})
watch(auto, (v) => {
  if (v) run()
})

const hasDiff = computed(() => result.value?.ok && (result.value.summary.added + result.value.summary.removed + result.value.summary.changed > 0))

async function copyPath(path) {
  await copyText(path)
  copiedPath.value = path
  setTimeout(() => (copiedPath.value = ''), 1200)
}
</script>

<template>
  <ToolShell tool-id="diff">
    <template #actions>
      <label class="check small">
        <input v-model="auto" type="checkbox" />
        {{ t('diff.autoCompare') }}
      </label>
      <button class="btn btn-primary btn-sm" @click="run">{{ t('diff.compare') }}</button>
    </template>

    <div class="col diff-grid">
      <div class="diff-inputs">
        <div class="col">
          <span class="muted tiny">{{ t('diff.left') }}</span>
          <textarea v-model="left" class="textarea code" rows="6" spellcheck="false" />
        </div>
        <div class="col">
          <span class="muted tiny">{{ t('diff.right') }}</span>
          <textarea v-model="right" class="textarea code" rows="6" spellcheck="false" />
        </div>
      </div>

      <template v-if="result">
        <Alert v-if="!result.ok" type="error">
          <div v-if="result.errorLeft"><b>{{ t('diff.parseFailLeft') }}</b><br /><code class="break-all">{{ result.errorLeft.message }}</code></div>
          <div v-if="result.errorRight"><b>{{ t('diff.parseFailRight') }}</b><br /><code class="break-all">{{ result.errorRight.message }}</code></div>
        </Alert>

        <template v-else>
          <div class="row-wrap">
            <span class="chip">{{ t('diff.added', { n: result.summary.added }) }}</span>
            <span class="chip">{{ t('diff.removed', { n: result.summary.removed }) }}</span>
            <span class="chip">{{ t('diff.changed', { n: result.summary.changed }) }}</span>
            <span class="chip">{{ t('diff.unchanged', { n: result.summary.unchanged }) }}</span>
            <span v-if="result.truncated" class="chip mod">{{ t('diff.truncated') }}</span>
            <span class="spacer" />
            <span class="muted tiny">{{ t('diff.pathHint') }}</span>
          </div>

          <Alert v-if="!hasDiff" type="success" dense>{{ t('diff.identical') }}</Alert>

          <div v-else class="row" style="gap: 6px">
            <button class="btn btn-sm" :class="{ 'btn-primary': view === 'list' }" @click="view = 'list'">
              {{ t('common.result') }}
            </button>
            <button class="btn btn-sm" :class="{ 'btn-primary': view === 'lines' }" @click="view = 'lines'">
              {{ t('common.lines') }}
            </button>
          </div>

          <div v-if="view === 'list' && hasDiff" class="diff-list card">
            <div
              v-for="(d, i) in result.diffs"
              :key="i"
              class="diff-row"
              :title="t('common.copy')"
              @click="copyPath(d.path)"
            >
              <span class="badge" :class="{ add: d.type === 'added', del: d.type === 'removed', mod: d.type === 'changed' }">
                {{ d.type === 'added' ? '+' : d.type === 'removed' ? '−' : '~' }}
              </span>
              <code class="diff-path">{{ copiedPath === d.path ? t('common.copied') + ' ✓' : d.path }}</code>
              <span class="diff-val del-val mono" v-if="d.type !== 'added'">{{ previewValue(d.left, 90) }}</span>
              <span class="diff-val mono" v-if="d.type !== 'removed'">{{ previewValue(d.right, 90) }}</span>
            </div>
          </div>

          <template v-if="view === 'lines' && hasDiff">
            <Alert v-if="linesNote" type="warn" dense>{{ linesNote }}</Alert>
            <div v-else class="line-diff card">
              <div class="line-col">
                <div
                  v-for="(l, i) in lines"
                  :key="i"
                  class="diff-line"
                  :class="l.type === 'del' || l.type === 'add' ? l.type : 'same'"
                >
                  <span v-if="l.type !== 'add'" class="diff-gutter">{{ l.aNo }}</span>
                  <span v-else class="diff-gutter" />
                  <span>{{ l.type === 'add' ? '' : l.text }}</span>
                </div>
              </div>
              <div class="line-col line-col-r">
                <div
                  v-for="(l, i) in lines"
                  :key="i"
                  class="diff-line"
                  :class="l.type === 'del' || l.type === 'add' ? l.type : 'same'"
                >
                  <span v-if="l.type !== 'del'" class="diff-gutter">{{ l.bNo }}</span>
                  <span v-else class="diff-gutter" />
                  <span>{{ l.type === 'del' ? '' : l.text }}</span>
                </div>
              </div>
            </div>
          </template>
        </template>
      </template>

      <EmptyState v-else icon="diff" :text="t('json.outputPlaceholder')" :hint="t('diff.pathHint')" />
    </div>
  </ToolShell>
</template>

<style scoped>
.diff-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.diff-list { max-height: 400px; overflow: auto; }
.diff-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 9px;
  border-bottom: 1px solid var(--border);
  cursor: copy;
  font-size: 12px;
}
.diff-row:last-child { border-bottom: 0; }
.diff-row:hover { background: var(--bg-hover); }
.diff-path { min-width: 90px; color: var(--fg-soft); flex: none; max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.diff-val { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.9; }
.del-val { text-decoration: line-through; color: var(--fg-mute); }
.line-diff {
  display: grid;
  grid-template-columns: 1fr 1fr;
  overflow: auto;
  max-height: 420px;
  font-family: var(--font-mono);
  font-size: 11.5px;
}
.line-col { border-right: 1px solid var(--border); min-width: 0; }
.line-col-r { border-right: 0; }
@media (max-width: 640px) {
  .diff-inputs, .line-diff { grid-template-columns: 1fr; }
  .line-col { border-right: 0; border-bottom: 1px solid var(--border); }
}
</style>
