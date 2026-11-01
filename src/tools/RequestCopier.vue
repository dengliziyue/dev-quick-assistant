<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import ToolShell from '../components/ToolShell.vue'
import Alert from '../components/Alert.vue'
import EmptyState from '../components/EmptyState.vue'
import CopyButton from '../components/CopyButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import { t } from '../utils/i18n'
import { getActiveTab, isHttpUrl, getCapturedRequests } from '../utils/messaging'
import { toCurl, toFetch, recordToTransferable } from '../core/curl'
import { truncateMiddle, formatDuration, formatClock } from '../utils/format'

const records = ref([])
const pageUrl = ref('')
const loadState = ref('loading') // loading | ok | nohook | unsupported
const query = ref('')
const expanded = ref(null)
const autoRefresh = ref(false)
let timer = null

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = [...records.value].reverse() // newest first
  if (!q) return list
  return list.filter(
    (r) => r.url.toLowerCase().includes(q) || r.method.toLowerCase().includes(q)
  )
})

async function refresh() {
  const tab = await getActiveTab()
  if (!tab || !isHttpUrl(tab.url)) {
    loadState.value = 'unsupported'
    return
  }
  const res = await getCapturedRequests(tab.id)
  if (res.ok) {
    records.value = res.requests || []
    pageUrl.value = res.pageUrl || tab.url
    loadState.value = 'ok'
  } else {
    loadState.value = 'nohook'
  }
}

onMounted(refresh)

function setAuto(v) {
  autoRefresh.value = v
  clearInterval(timer)
  if (v) timer = setInterval(refresh, 3000)
}
onBeforeUnmount(() => clearInterval(timer))

function toggleExpand(r) {
  expanded.value = expanded.value?.id === r.id ? null : r
}

const curlCmd = (r) => toCurl(recordToTransferable(r))
const fetchCode = (r) => toFetch(recordToTransferable(r))
const recordJson = (r) =>
  JSON.stringify(
    {
      method: r.method,
      url: r.url,
      requestHeaders: Object.fromEntries(r.reqHeaders || []),
      body: r.body || undefined
    },
    null,
    2
  )

function statusClass(status) {
  if (!status) return 'err'
  if (status < 300) return 'ok'
  if (status < 400) return 'other'
  return 'err'
}

function methodClass(method) {
  const m = method.toLowerCase()
  return ['get', 'post', 'put', 'delete', 'patch'].includes(m) ? m : 'other'
}

function hostname(url) {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}
</script>

<template>
  <ToolShell tool-id="request">
    <template #actions>
      <button class="btn btn-sm" @click="refresh">
        <AppIcon name="refresh" :size="13" /> {{ t('common.refresh') }}
      </button>
    </template>

    <div class="col">
      <Alert v-if="loadState === 'unsupported'" type="warn">{{ t('cookie.unsupportedUrl') }}</Alert>

      <template v-else>
        <div class="row-wrap">
          <span class="chip">{{ t('request.listTitle', { n: records.length }) }}</span>
          <label class="check small">
            <input type="checkbox" :checked="autoRefresh" @change="setAuto($event.target.checked)" />
            {{ t('request.autoRefresh') }}
          </label>
          <span class="spacer" />
          <CopyButton v-if="records.length" :text="() => filtered.map((r) => r.url).join('\n')" :label="t('image.copyUrls')" />
        </div>

        <input v-model="query" class="input" :placeholder="t('request.filterPlaceholder')" />

        <Alert v-if="loadState === 'nohook'" type="warn">
          {{ t('request.noRequests') }}<br />{{ t('request.needRefresh') }}
        </Alert>
        <p class="tiny muted">{{ t('request.captureNote') }} · {{ t('request.expandHint') }}</p>

        <EmptyState v-if="loadState === 'ok' && !filtered.length" icon="globe" :text="t('request.noRequests')" />

        <div v-else class="card list">
          <div
            v-for="r in filtered.slice(0, 200)"
            :key="r.id"
            class="req"
            :class="{ open: expanded?.id === r.id }"
            @click="toggleExpand(r)"
          >
            <div class="req-row">
              <span class="badge" :class="methodClass(r.method)">{{ r.method }}</span>
              <span class="req-url mono" :title="r.url">{{ hostname(r.url) }}<span class="muted">{{ truncateMiddle(r.url.replace(/^https?:\/\/[^/]+/, ''), 60) }}</span></span>
              <span class="badge" :class="statusClass(r.status)">{{ r.status || (r.error ? 'ERR' : '…') }}</span>
              <span class="tiny muted nowrap">{{ formatDuration(r.duration) }}</span>
              <span class="tiny muted nowrap">{{ formatClock(r.ts) }}</span>
              <span class="tiny muted nowrap">{{ r.kind === 'xhr' ? t('request.xhr') : t('request.fetch') }}</span>
            </div>

            <div v-if="expanded?.id === r.id" class="req-detail" @click.stop>
              <div class="req-actions">
                <CopyButton :text="curlCmd(r)" :label="t('request.copyCurl')" primary />
                <CopyButton :text="fetchCode(r)" :label="t('request.copyFetch')" />
                <CopyButton :text="recordJson(r)" :label="t('request.copyJson')" />
                <CopyButton :text="r.url" :label="t('request.url')" />
              </div>

              <p class="mono tiny break-all req-fullurl">{{ r.url }}</p>

              <Alert v-if="r.error" type="error" dense>{{ r.error }}</Alert>

              <div class="kv-cols">
                <div>
                  <p class="tiny muted">{{ t('request.headers') }} ({{ r.reqHeaders?.length || 0 }})</p>
                  <table class="table">
                    <tbody>
                      <tr v-for="[k, v] in r.reqHeaders || []" :key="k + v">
                        <td class="mono tiny">{{ k }}</td>
                        <td class="mono tiny break-all">{{ v }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div>
                  <p class="tiny muted">{{ t('request.resHeaders') }} ({{ r.resHeaders?.length || 0 }})</p>
                  <table class="table">
                    <tbody>
                      <tr v-for="[k, v] in r.resHeaders || []" :key="k + v">
                        <td class="mono tiny">{{ k }}</td>
                        <td class="mono tiny break-all">{{ v }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div v-if="r.body">
                <p class="tiny muted">{{ t('request.body') }}</p>
                <pre class="code-block wrap">{{ r.body.slice(0, 20000) }}<template v-if="r.body.length > 20000">{{ t('request.bodyTruncated') }}</template></pre>
              </div>
              <p v-else class="tiny muted">{{ t('request.noBody') }}</p>
            </div>
          </div>
        </div>
      </template>
    </div>
  </ToolShell>
</template>

<style scoped>
.list { max-height: 520px; overflow: auto; }
.req { border-bottom: 1px solid var(--border); }
.req:last-child { border-bottom: 0; }
.req-row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 9px;
  cursor: pointer;
}
.req-row:hover { background: var(--bg-hover); }
.req.open { background: var(--bg-inset); }
.req-url {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11.5px;
}
.req-detail { padding: 8px 11px 11px; display: flex; flex-direction: column; gap: 8px; }
.req-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.req-fullurl { color: var(--fg-mute); }
.kv-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 520px) { .kv-cols { grid-template-columns: 1fr; } }
</style>
