<script setup>
import { ref, computed, onMounted } from 'vue'
import ToolShell from '../components/ToolShell.vue'
import Alert from '../components/Alert.vue'
import EmptyState from '../components/EmptyState.vue'
import Modal from '../components/Modal.vue'
import CopyButton from '../components/CopyButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import { t } from '../utils/i18n'
import { getActiveTab, isHttpUrl } from '../utils/messaging'
import { cookiesToJson, cookiesToNetscape, cookiesToHeader, parseImportCookies, cookieToSetParams, formatExpiry } from '../core/cookie'
import { downloadText } from '../utils/clipboard'
import { formatBytes, truncateMiddle } from '../utils/format'

const cookies = ref([])
const loading = ref(false)
const unsupported = ref(false)
const loadError = ref('')
const query = ref('')
const showValues = ref(false)
const importOpen = ref(false)
const importText = ref('')
const importResult = ref(null)
const tabUrl = ref('')

const host = computed(() => {
  try {
    return new URL(tabUrl.value).hostname
  } catch {
    return ''
  }
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return cookies.value
  return cookies.value.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      String(c.value).toLowerCase().includes(q) ||
      String(c.domain).toLowerCase().includes(q)
  )
})

async function refresh() {
  loading.value = true
  loadError.value = ''
  try {
    const tab = await getActiveTab()
    if (!tab || !isHttpUrl(tab.url)) {
      unsupported.value = true
      cookies.value = []
      return
    }
    unsupported.value = false
    tabUrl.value = tab.url
    const hostname = new URL(tab.url).hostname
    let list = await chrome.cookies.getAll({ domain: hostname })
    if (!list.length) list = await chrome.cookies.getAll({ url: tab.url })
    cookies.value = list
  } catch (e) {
    loadError.value = String(e?.message || e)
  } finally {
    loading.value = false
  }
}

onMounted(refresh)

async function deleteCookie(c) {
  try {
    const url = `http${c.secure ? 's' : ''}://${(c.domain || '').replace(/^\./, '')}${c.path || '/'}`
    await chrome.cookies.remove({ name: c.name, url })
    cookies.value = cookies.value.filter((x) => !(x.name === c.name && x.domain === c.domain && x.path === c.path))
  } catch (e) {
    loadError.value = String(e?.message || e)
  }
}

async function deleteVisible() {
  if (!confirm(t('cookie.delVisible') + ` (${filtered.value.length})?`)) return
  for (const c of [...filtered.value]) await deleteCookie(c)
}

async function runImport() {
  importResult.value = null
  const parsed = parseImportCookies(importText.value)
  if (!parsed.ok) {
    importResult.value = { ok: 0, fail: 1, error: parsed.error }
    return
  }
  let ok = 0
  let fail = 0
  for (const c of parsed.cookies) {
    try {
      await chrome.cookies.set(cookieToSetParams(c))
      ok++
    } catch {
      fail++
    }
  }
  importResult.value = { ok, fail }
  if (ok) {
    importOpen.value = false
    importText.value = ''
    refresh()
  }
}

function exportFile(kind) {
  const base = (host.value || 'cookies').replace(/[^\w.-]/g, '_')
  if (kind === 'json') downloadText(`${base}-cookies.json`, cookiesToJson(cookies.value), 'application/json')
  else if (kind === 'netscape') downloadText(`${base}-cookies.txt`, cookiesToNetscape(cookies.value))
  else downloadText(`${base}-cookies-header.txt`, cookiesToHeader(cookies.value))
}

const totalSize = computed(() => cookies.value.reduce((n, c) => n + c.name.length + String(c.value ?? '').length, 0))
</script>

<template>
  <ToolShell tool-id="cookie">
    <template #actions>
      <button class="btn btn-sm" @click="refresh">
        <AppIcon name="refresh" :size="13" /> {{ t('common.refresh') }}
      </button>
    </template>

    <div class="col">
      <Alert v-if="unsupported" type="warn">{{ t('cookie.unsupportedUrl') }}</Alert>
      <Alert v-else-if="loadError" type="error">{{ loadError }}</Alert>

      <template v-else>
        <div class="row-wrap">
          <span class="chip">{{ host }} · {{ t('common.total', { n: cookies.length }) }} · {{ formatBytes(totalSize) }}</span>
          <span class="spacer" />
          <label class="check small" :title="t('cookie.maskHint')">
            <input v-model="showValues" type="checkbox" />
            <AppIcon :name="showValues ? 'eye' : 'eye-off'" :size="13" />
          </label>
        </div>

        <div class="row-wrap">
          <input v-model="query" class="input grow" :placeholder="t('cookie.searchPlaceholder')" />
          <CopyButton :text="() => cookiesToHeader(filtered)" :label="t('cookie.copyHeader')" />
          <button class="btn btn-sm" @click="exportFile('json')">{{ t('cookie.exportJson') }}</button>
          <button class="btn btn-sm" @click="exportFile('netscape')">{{ t('cookie.exportNetscape') }}</button>
          <button class="btn btn-sm" @click="importOpen = true">{{ t('common.import') }}</button>
          <button class="btn btn-danger btn-sm" :disabled="!filtered.length" @click="deleteVisible">
            <AppIcon name="trash" :size="13" /> {{ t('cookie.delVisible') }}
          </button>
        </div>

        <EmptyState v-if="!filtered.length" icon="cookie" :text="t('cookie.noCookie')" />

        <div v-else class="card list">
          <table class="table">
            <thead>
              <tr>
                <th style="width: 26%">{{ t('cookie.name') }}</th>
                <th>{{ t('cookie.value') }}</th>
                <th>{{ t('cookie.domain') }}</th>
                <th>{{ t('cookie.expires') }}</th>
                <th style="width: 70px" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="(c, i) in filtered.slice(0, 500)" :key="i">
                <td>
                  <div class="row" style="gap: 4px">
                    <code class="break-all">{{ c.name }}</code>
                    <CopyButton :text="c.name" icon-only />
                  </div>
                  <div class="row tiny" style="gap: 3px">
                    <span v-if="c.httpOnly" class="badge mod" :title="t('cookie.httpOnly')">H</span>
                    <span v-if="c.secure" class="badge ok" :title="t('cookie.secure')">S</span>
                    <span v-if="!c.session" class="badge other" :title="t('cookie.sameSite')">{{ c.sameSite?.slice(0, 4) }}</span>
                    <span class="muted">{{ c.path }}</span>
                  </div>
                </td>
                <td class="mono break-all">
                  <template v-if="showValues">{{ c.value }}</template>
                  <template v-else>{{ '•'.repeat(Math.min(String(c.value).length, 12)) || c.value }}</template>
                  <CopyButton :text="c.value" icon-only />
                </td>
                <td class="tiny mono">{{ truncateMiddle(String(c.domain), 24) }}</td>
                <td class="tiny muted">{{ formatExpiry(c) }}</td>
                <td>
                  <button class="btn btn-ghost btn-icon" :title="t('cookie.delOne')" @click="deleteCookie(c)">
                    <AppIcon name="trash" :size="13" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>

    <Modal :open="importOpen" :title="t('cookie.importTitle')" @close="importOpen = false">
      <div class="col">
        <p class="muted small">{{ t('cookie.importHint') }}</p>
        <textarea v-model="importText" class="textarea code" rows="8" spellcheck="false" />
        <Alert v-if="importResult" type="error" dense>
          {{ t('cookie.importDone', { ok: importResult.ok, fail: importResult.fail }) }}
          <code v-if="importResult.error">{{ importResult.error }}</code>
        </Alert>
      </div>
      <template #footer>
        <button class="btn" @click="importOpen = false">{{ t('common.cancel') }}</button>
        <button class="btn btn-primary" :disabled="!importText.trim()" @click="runImport">
          {{ t('common.import') }}
        </button>
      </template>
    </Modal>
  </ToolShell>
</template>

<style scoped>
.list { max-height: 480px; overflow: auto; }
</style>
