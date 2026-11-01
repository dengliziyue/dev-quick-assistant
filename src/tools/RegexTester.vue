<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import ToolShell from '../components/ToolShell.vue'
import CodeArea from '../components/CodeArea.vue'
import Alert from '../components/Alert.vue'
import EmptyState from '../components/EmptyState.vue'
import { t } from '../utils/i18n'
import { runRegexAsync } from '../core/regex-async'
import { replaceRegex } from '../core/regex'
import { REGEX_PRESETS } from '../core/regex'
import { formatDuration } from '../utils/format'
import { debounce } from '../utils/format'

const pattern = ref('\\d+')
const flags = ref('g')
const text = ref('订单号: 20240601, 金额: 128.50\n订单号: 20240602, 金额: 96.00')
const replacement = ref('[$&]')
const result = ref(null)
const running = ref(false)

const PRESET_I18N = { email: 'presetEmail', url: 'presetUrl', ip: 'presetIp', date: 'presetDate', mobile: 'presetMobile', hex: 'presetHex' }
const FLAG_DEFS = [
  { key: 'g', i18n: 'flagG' },
  { key: 'i', i18n: 'flagI' },
  { key: 'm', i18n: 'flagM' },
  { key: 's', i18n: 'flagS' },
  { key: 'u', i18n: 'flagU' },
  { key: 'y', i18n: 'flagY' }
]

function toggleFlag(key) {
  flags.value = flags.value.includes(key)
    ? flags.value.replace(key, '')
    : flags.value + key
}

function applyPreset(id) {
  const preset = REGEX_PRESETS.find((p) => p.id === id)
  if (!preset) return
  pattern.value = preset.pattern
  flags.value = preset.flags
}

async function run() {
  running.value = true
  result.value = await runRegexAsync(pattern.value, flags.value, text.value)
  running.value = false
}

const debouncedRun = debounce(run, 300)
watch([pattern, flags, text], debouncedRun)
onMounted(run)

const matchCount = computed(() => (result.value?.ok ? result.value.count : 0))

/** highlighted sample (capped) */
const RENDER_CAP = 100_000
const highlight = computed(() => {
  if (!result.value?.ok || !result.value.matches.length) return ''
  const { matches, textUsed } = result.value
  const cut = textUsed.length > RENDER_CAP
  const src = cut ? textUsed.slice(0, RENDER_CAP) : textUsed
  const esc = (s) =>
    s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
  let out = ''
  let last = 0
  let shown = 0
  for (const m of matches) {
    if (m.index >= src.length) break
    if (m.end === m.index) continue
    out += esc(src.slice(last, m.index))
    out += `<mark class="rex-match" title="#${shown + 1}">${esc(m.text)}</mark>`
    last = Math.max(last, m.end)
    shown++
    if (last >= src.length) break
  }
  out += esc(src.slice(last))
  return out + (cut ? '\n…' : '')
})

const replacePreview = computed(() => {
  if (!result.value?.ok || !matchCount.value || replacement.value === '') return null
  const res = replaceRegex(pattern.value, flags.value, result.value.textUsed, replacement.value)
  return res.ok ? res.result.slice(0, 5000) : null
})
</script>

<template>
  <ToolShell tool-id="regex">
    <template #actions>
      <select class="select small" @change="applyPreset($event.target.value); $event.target.value = ''">
        <option value="" disabled selected>{{ t('regex.presets') }}</option>
        <option v-for="p in REGEX_PRESETS" :key="p.id" :value="p.id">{{ t('regex.' + PRESET_I18N[p.id]) }}</option>
      </select>
    </template>

    <div class="col">
      <div class="row-wrap">
        <div class="grow pat-box">
          <input
            v-model="pattern"
            class="input mono"
            :placeholder="t('regex.pattern')"
            spellcheck="false"
            :class="{ 'pat-err': result && !result.ok }"
          />
        </div>
        <div class="flag-box">
          <button
            v-for="f in FLAG_DEFS"
            :key="f.key"
            class="btn btn-sm flag-btn"
            :class="{ 'btn-primary': flags.includes(f.key) }"
            :title="t('regex.' + f.i18n)"
            type="button"
            @click="toggleFlag(f.key)"
          >
            {{ f.key }}
          </button>
        </div>
      </div>

      <Alert v-if="result && !result.ok" type="error">
        <b>{{ t('regex.invalid') }}</b>
        <template #details>{{ result.error.message }}</template>
      </Alert>

      <CodeArea v-model="text" :rows="6" :placeholder="t('regex.testText')" />

      <template v-if="result && result.ok">
        <div class="row-wrap">
          <span class="chip" :class="{ ok: matchCount > 0 }">
            {{ matchCount ? t('regex.matchN', { n: matchCount }) : t('regex.noMatch') }}
          </span>
          <span v-if="result.truncated" class="chip mod">{{ t('regex.execError') }}</span>
          <span class="chip">{{ formatDuration(result.timeMs) }}</span>
          <span v-if="result.textCut" class="chip mod">{{ t('regex.tooLong', { n: 20 }) }}</span>
        </div>

        <div v-if="highlight" class="card hl-box" v-html="highlight" />

        <div v-if="result.matches.length" class="card match-list">
          <table class="table">
            <thead>
              <tr>
                <th>#</th>
                <th>{{ t('regex.fullMatch') }}</th>
                <th v-if="result.groupCount">{{ t('regex.groups') }}</th>
                <th class="num">{{ t('regex.index') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(m, i) in result.matches.slice(0, 100)" :key="i">
                <td class="num muted">{{ i + 1 }}</td>
                <td class="mono break-all">{{ m.text || '(empty)' }}</td>
                <td v-if="result.groupCount" class="mono break-all">
                  <template v-if="m.groups.some((g) => g != null)">
                    <span v-for="(g, gi) in m.groups" :key="gi" class="chip tiny" style="margin-right: 4px">
                      ${{ gi + 1 }}: {{ g == null ? '-' : g.length > 40 ? g.slice(0, 40) + '…' : g }}
                    </span>
                    <span v-if="m.named" class="tiny muted">
                      {{ t('regex.namedGroups') }}: {{ JSON.stringify(m.named) }}
                    </span>
                  </template>
                  <template v-else>—</template>
                </td>
                <td class="num muted mono">{{ m.index }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="result.matches.length > 100" class="muted tiny" style="padding: 6px 9px">
            … {{ result.matches.length - 100 }}+
          </p>
        </div>

        <div class="row-wrap">
          <input v-model="replacement" class="input mono grow" :placeholder="t('regex.replace')" spellcheck="false" />
        </div>
        <pre v-if="replacePreview" class="code-block wrap">{{ replacePreview }}</pre>
      </template>

      <EmptyState v-else-if="result && result.ok && !matchCount" icon="regex" :text="t('regex.noMatch')" />
    </div>
  </ToolShell>
</template>

<style scoped>
.pat-box { min-width: 160px; }
.pat-err { border-color: var(--danger); }
.flag-box { display: flex; gap: 3px; }
.flag-btn { min-width: 26px; padding: 3px 6px; font-family: var(--font-mono); }
.hl-box {
  padding: 8px 10px;
  max-height: 180px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
}
.match-list { max-height: 260px; overflow: auto; }
</style>
