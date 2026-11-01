<script setup>
import { ref, computed, onMounted } from 'vue'
import ToolShell from '../components/ToolShell.vue'
import Alert from '../components/Alert.vue'
import EmptyState from '../components/EmptyState.vue'
import CopyButton from '../components/CopyButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import { t } from '../utils/i18n'
import { getActiveTab, isHttpUrl, execOnTab, mapExecError } from '../utils/messaging'
import { collectPageStorage, writePageStorage, removePageStorageKey, clearPageStorage } from '../utils/page-collectors'
import { downloadText } from '../utils/clipboard'
import { formatBytes, truncateMiddle } from '../utils/format'

const kind = ref('local') // 'local' | 'session'
const items = ref([])
const loadState = ref('loading') // loading | ok | unsupported | error
const errorMsg = ref('')
const query = ref('')
const editing = ref(null) // key being edited
const editValue = ref('')
const addKey = ref('')
const addValue = ref('')
const showAdd = ref(false)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return items.value
  return items.value.filter((i) => i.key.toLowerCase().includes(q) || i.value.toLowerCase().includes(q))
})

const totalSize = computed(() => items.value.reduce((n, i) => n + i.size, 0))

async function refresh() {
  const tab = await getActiveTab()
  if (!tab || !isHttpUrl(tab.url)) {
    loadState.value = 'unsupported'
    return
  }
  try {
    const res = await execOnTab(tab.id, collectPageStorage, [kind.value, 2048])
    if (res && !res.error) {
      items.value = res.items || []
      loadState.value = 'ok'
    } else {
      loadState.value = 'error'
      errorMsg.value = res?.error || ''
    }
  } catch (e) {
    loadState.value = 'error'
    errorMsg.value = mapExecError(e)
  }
}
onMounted(refresh)

function switchKind(k) {
  kind.value = k
  editing.value = null
  refresh()
}

async function saveEdit(key) {
  const tab = await getActiveTab()
  if (!tab) return
  const res = await execOnTab(tab.id, writePageStorage, [kind.value, key, editValue.value])
  if (res?.ok) {
    editing.value = null
    refresh()
  } else {
    alert(t('storage.saveFail', { msg: res?.error || '?' }))
  }
}

async function deleteItem(item) {
  if (!confirm(t('common.confirmDelete'))) return
  const tab = await getActiveTab()
  if (!tab) return
  await execOnTab(tab.id, removePageStorageKey, [kind.value, item.key])
  refresh()
}

async function addEntry() {
  const key = addKey.value.trim()
  if (!key) return
  const tab = await getActiveTab()
  if (!tab) return
  const res = await execOnTab(tab.id, writePageStorage, [kind.value, key, addValue.value])
  if (res?.ok) {
    addKey.value = ''
    addValue.value = ''
    showAdd.value = false
    refresh()
  } else {
    alert(t('storage.saveFail', { msg: res?.error || '?' }))
  }
}

async function clearAll() {
  if (!confirm(t('storage.clearAllConfirm', { type: kind.value }))) return
  const tab = await getActiveTab()
  if (!tab) return
  await execOnTab(tab.id, clearPageStorage, [kind.value])
  refresh()
}

function exportJson() {
  const data = Object.fromEntries(items.value.map((i) => [i.key, i.value]))
  downloadText(`${kind.value}-${Date.now()}.json`, JSON.stringify(data, null, 2), 'application/json')
}

function startEdit(item) {
  editing.value = item.key
  editValue.value = item.value
}
</script>

<template>
  <ToolShell tool-id="storage">
    <template #actions>
      <button class="btn btn-sm" @click="refresh">
        <AppIcon name="refresh" :size="13" /> {{ t('common.refresh') }}
      </button>
    </template>

    <div class="col">
      <Alert v-if="loadState === 'unsupported'" type="warn">{{ t('cookie.unsupportedUrl') }}</Alert>
      <Alert v-else-if="loadState === 'error'" type="error">
        {{ t('storage.readFail') }}
        <template #details>{{ errorMsg }}</template>
      </Alert>

      <template v-else>
        <div class="row-wrap">
          <button class="btn btn-sm" :class="{ 'btn-primary': kind === 'local' }" @click="switchKind('local')">
            {{ t('storage.local') }}
          </button>
          <button class="btn btn-sm" :class="{ 'btn-primary': kind === 'session' }" @click="switchKind('session')">
            {{ t('storage.session') }}
          </button>
          <span class="chip tiny">{{ t('storage.totalSize', { n: items.length, size: formatBytes(totalSize) }) }}</span>
          <span class="spacer" />
          <CopyButton :text="() => JSON.stringify(Object.fromEntries(items.map((i) => [i.key, i.value])))" :label="t('common.copy')" />
          <button class="btn btn-sm" @click="exportJson">{{ t('storage.exportJson') }}</button>
          <button class="btn btn-sm" @click="showAdd = !showAdd">
            <AppIcon name="plus" :size="13" /> {{ t('storage.addKey') }}
          </button>
          <button class="btn btn-danger btn-sm" :disabled="!items.length" @click="clearAll">
            {{ t('storage.clearAll') }}
          </button>
        </div>

        <div v-if="showAdd" class="panel col">
          <input v-model="addKey" class="input mono" :placeholder="t('storage.keyPlaceholder')" spellcheck="false" />
          <textarea v-model="addValue" class="textarea code" rows="3" :placeholder="t('storage.valuePlaceholder')" spellcheck="false" />
          <div class="row">
            <span class="tiny muted">{{ t('storage.dupKey') }}</span>
            <span class="spacer" />
            <button class="btn btn-primary btn-sm" :disabled="!addKey.trim()" @click="addEntry">
              {{ t('common.save') }}
            </button>
          </div>
        </div>

        <input v-model="query" class="input" :placeholder="t('common.search')" />
        <p class="tiny muted">{{ t('storage.editHint') }}</p>

        <EmptyState v-if="!filtered.length" icon="database" :text="t('common.empty')" />

        <div v-else class="card list">
          <div v-for="item in filtered.slice(0, 500)" :key="item.key" class="st-row">
            <div class="st-head">
              <code class="st-key">{{ truncateMiddle(item.key, 60) }}</code>
              <span class="tiny muted nowrap">{{ formatBytes(item.size) }}</span>
              <span class="spacer" />
              <CopyButton :text="item.value" icon-only />
              <button class="btn btn-ghost btn-icon" :title="t('common.edit')" @click="startEdit(item)">
                <AppIcon name="edit" :size="13" />
              </button>
              <button class="btn btn-ghost btn-icon" :title="t('common.del')" @click="deleteItem(item)">
                <AppIcon name="trash" :size="13" />
              </button>
            </div>
            <template v-if="editing === item.key">
              <textarea v-model="editValue" class="textarea code" rows="5" @keydown.enter.exact.prevent.ctrl="saveEdit(item.key)" @keydown.enter.exact.prevent.meta="saveEdit(item.key)" />
              <div class="row">
                <span class="tiny muted">{{ editValue.length }} {{ t('common.chars') }}</span>
                <span class="spacer" />
                <button class="btn btn-sm" @click="editing = null">{{ t('common.cancel') }}</button>
                <button class="btn btn-primary btn-sm" @click="saveEdit(item.key)">{{ t('common.save') }}</button>
              </div>
            </template>
            <pre v-else class="st-value" :title="item.truncated ? t('storage.bigValue') : ''">{{ item.preview }}<span v-if="item.truncated" class="muted"> …</span></pre>
          </div>
        </div>
      </template>
    </div>
  </ToolShell>
</template>

<style scoped>
.list { max-height: 480px; overflow: auto; }
.st-row { padding: 7px 10px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 5px; }
.st-row:last-child { border-bottom: 0; }
.st-head { display: flex; align-items: center; gap: 6px; }
.st-key { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.st-value {
  margin: 0;
  background: var(--code-bg);
  border-radius: 5px;
  padding: 5px 8px;
  font-family: var(--font-mono);
  font-size: 11.5px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 90px;
  overflow: hidden;
  cursor: pointer;
}
</style>
