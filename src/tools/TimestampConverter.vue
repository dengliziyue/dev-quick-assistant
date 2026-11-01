<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import ToolShell from '../components/ToolShell.vue'
import Alert from '../components/Alert.vue'
import CopyButton from '../components/CopyButton.vue'
import { t } from '../utils/i18n'
import {
  TIMEZONES,
  tsToMs,
  extractTimestamps,
  datePartsInTz,
  formatInTz,
  formatIso,
  formatLocale,
  parseDateInput,
  relativeInfo
} from '../core/time'
import { formatClock } from '../utils/format'

/* ---- live clock ---- */
const now = ref(Date.now())
let timer = null
onMounted(() => {
  timer = setInterval(() => (now.value = Date.now()), 1000)
})
onBeforeUnmount(() => clearInterval(timer))

/* ---- ts -> date ---- */
const tsInput = ref('')
const tsUnit = ref('auto')
const tz = ref('local')

const parsedMs = computed(() => (tsInput.value.trim() ? tsToMs(tsInput.value, tsUnit.value) : null))
const tsValid = computed(() => parsedMs.value != null && Math.abs(parsedMs.value) <= 8.64e15)
const tsDate = computed(() => (tsValid.value ? new Date(parsedMs.value) : null))
const unitLabel = computed(() => {
  if (!tsInput.value.trim()) return ''
  const digits = Math.abs(Math.trunc(Number(tsInput.value))).toString().length
  return digits <= 10 ? t('time.seconds') : digits === 13 ? t('time.millis') : t('time.auto')
})

const rows = computed(() => {
  if (!tsDate.value) return []
  const d = tsDate.value
  const rel = relativeInfo(parsedMs.value - now.value)
  return [
    { label: `${t('time.fmtCustom')} (${tz.value})`, value: formatInTz(d, tz.value === 'local' ? undefined : tz.value) },
    { label: t('time.fmtIso'), value: formatIso(d) },
    { label: t('time.fmtLocal'), value: formatLocale(d, tz.value === 'local' ? undefined : tz.value) },
    { label: 'UTC ' + formatInTz(d, 'UTC'), value: formatInTz(d, 'UTC', 'yyyy-MM-dd HH:mm:ss') },
    {
      label: t('time.relativeNow'),
      value: rel.now
        ? t('time.relativeNow')
        : `${t('time.relative' + (rel.future ? 'Later' : 'Ago'), { n: rel.n + ' ' + t('time.' + rel.unit) })}`
    }
  ]
})

/* ---- date -> ts ---- */
const dateInput = ref('')
const dateTz = ref('local')
const dateErr = ref('')
const dateOut = ref(null)

function convertDate() {
  dateErr.value = ''
  dateOut.value = null
  if (!dateInput.value) return
  const res = parseDateInput(dateInput.value, dateTz.value)
  if (!res.ok) {
    dateErr.value = t('time.invalidDate')
    return
  }
  dateOut.value = {
    s: Math.floor(res.date.getTime() / 1000),
    ms: res.date.getTime()
  }
}

/* ---- batch ---- */
const batchText = ref('')
const batchItems = computed(() => (batchText.value ? extractTimestamps(batchText.value) : []))

const tzOptions = computed(() => ['local', ...TIMEZONES])
</script>

<template>
  <ToolShell tool-id="time">
    <div class="col">
      <!-- now -->
      <div class="panel now-panel">
        <div class="row">
          <span class="chip">{{ t('time.now') }}</span>
          <span class="mono now-ms">{{ now }}</span>
          <CopyButton :text="String(now)" icon-only />
          <span class="muted mono">{{ Math.floor(now / 1000) }}</span>
          <CopyButton :text="String(Math.floor(now / 1000))" icon-only />
          <span class="spacer" />
          <span class="mono muted">{{ formatClock(now) }}</span>
        </div>
      </div>

      <!-- ts -> date -->
      <div class="panel col">
        <div class="row-wrap">
          <b class="small">{{ t('time.tsToDate') }}</b>
          <input
            v-model="tsInput"
            class="input mono"
            style="max-width: 220px"
            :placeholder="t('time.tsPlaceholder')"
            inputmode="numeric"
          />
          <select v-model="tsUnit" class="select" style="width: 110px">
            <option value="auto">{{ t('time.auto') }}</option>
            <option value="s">{{ t('time.seconds') }}</option>
            <option value="ms">{{ t('time.millis') }}</option>
          </select>
          <select v-model="tz" class="select" style="width: 170px">
            <option v-for="z in tzOptions" :key="z" :value="z">
              {{ z === 'local' ? t('time.local') : z }}
            </option>
          </select>
          <span v-if="tsInput && tsValid" class="chip ok tiny">{{ unitLabel }}</span>
        </div>

        <Alert v-if="tsInput && !tsValid" type="error" dense>{{ t('time.invalidDate') }}</Alert>

        <table v-if="tsValid && rows.length" class="table">
          <tbody>
            <tr v-for="r in rows" :key="r.label">
              <td class="muted" style="width: 40%">{{ r.label }}</td>
              <td class="mono break-all">{{ r.value }}</td>
              <td style="width: 30px"><CopyButton :text="r.value" icon-only /></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- date -> ts -->
      <div class="panel col">
        <b class="small">{{ t('time.dateToTs') }}</b>
        <div class="row-wrap">
          <input v-model="dateInput" type="datetime-local" step="1" class="input" style="max-width: 220px" />
          <select v-model="dateTz" class="select" style="width: 170px">
            <option v-for="z in tzOptions" :key="z" :value="z">
              {{ z === 'local' ? t('time.local') : z }}
            </option>
          </select>
          <button class="btn btn-primary btn-sm" @click="convertDate">{{ t('common.run') }}</button>
        </div>
        <Alert v-if="dateErr" type="error" dense>{{ dateErr }}</Alert>
        <div v-if="dateOut" class="row-wrap mono small">
          <span class="chip">s: {{ dateOut.s }} <CopyButton :text="String(dateOut.s)" icon-only /></span>
          <span class="chip">ms: {{ dateOut.ms }} <CopyButton :text="String(dateOut.ms)" icon-only /></span>
        </div>
      </div>

      <!-- batch -->
      <div class="panel col">
        <b class="small">{{ t('time.batch') }}</b>
        <textarea v-model="batchText" class="textarea code" rows="3" :placeholder="t('time.batchPlaceholder')" spellcheck="false" />
        <p v-if="batchText" class="tiny" :class="batchItems.length ? 'muted' : 'muted'">
          {{ batchItems.length ? t('time.found', { n: batchItems.length }) : t('time.notFound') }}
        </p>
        <table v-if="batchItems.length" class="table">
          <thead>
            <tr>
              <th>{{ t('common.input') }}</th>
              <th>{{ t('time.unit') }}</th>
              <th>{{ t('common.result') }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, i) in batchItems.slice(0, 200)" :key="i">
              <td class="mono">{{ item.raw }}</td>
              <td class="muted tiny">{{ item.unit }}</td>
              <td class="mono">{{ formatInTz(new Date(item.ms), tz === 'local' ? undefined : tz) }}</td>
              <td><CopyButton :text="String(item.ms)" icon-only /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </ToolShell>
</template>

<style scoped>
.now-panel { background: var(--accent-soft); border-color: transparent; }
.now-ms { font-size: 15px; font-weight: 600; color: var(--fg); }
</style>
