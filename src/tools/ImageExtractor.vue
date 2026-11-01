<script setup>
import { ref, computed, onMounted } from 'vue'
import ToolShell from '../components/ToolShell.vue'
import Alert from '../components/Alert.vue'
import EmptyState from '../components/EmptyState.vue'
import CopyButton from '../components/CopyButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import { t } from '../utils/i18n'
import { getActiveTab, isHttpUrl, execOnTab, mapExecError } from '../utils/messaging'
import { collectPageImages } from '../utils/page-collectors'
import { settings } from '../utils/settings'
import { downloadFile } from '../utils/clipboard'

const images = ref([])
const loadState = ref('loading') // loading | ok | unsupported | error
const errorMsg = ref('')
const docUrl = ref('')
const loadThumbs = ref(settings.imageThumbs)
const includeCss = ref(true)
const includeIcons = ref(true)
const minW = ref(0)
const minH = ref(0)
const typeFilter = ref('all')
const selected = ref(new Set())
const downloading = ref('')

async function extract() {
  loadState.value = 'loading'
  selected.value = new Set()
  const tab = await getActiveTab()
  if (!tab || !isHttpUrl(tab.url)) {
    loadState.value = 'unsupported'
    return
  }
  try {
    const res = await execOnTab(tab.id, collectPageImages, [
      { max: 3000, includeCss: includeCss.value, includeIcons: includeIcons.value }
    ])
    if (res && res.items) {
      images.value = res.items
      docUrl.value = res.docUrl || tab.url
      loadState.value = 'ok'
    } else {
      loadState.value = 'error'
      errorMsg.value = ''
    }
  } catch (e) {
    loadState.value = 'error'
    errorMsg.value = mapExecError(e)
  }
}
onMounted(extract)

const types = computed(() => {
  const set = new Set(images.value.map((i) => i.type))
  return ['all', ...[...set].sort()]
})

const filtered = computed(() => {
  return images.value.filter((img) => {
    if (typeFilter.value !== 'all' && img.type !== typeFilter.value) return false
    if (minW.value > 0 && img.w && img.w < minW.value) return false
    if (minH.value > 0 && img.h && img.h < minH.value) return false
    return true
  })
})

function toggleSelect(url) {
  const next = new Set(selected.value)
  next.has(url) ? next.delete(url) : next.add(url)
  selected.value = next
}
function selectAll() {
  selected.value = new Set(filtered.value.map((i) => i.url))
}
function selectNone() {
  selected.value = new Set()
}

function fileNameOf(url, idx) {
  try {
    if (url.startsWith('data:')) return `image-${idx + 1}.png`
    const path = new URL(url).pathname
    const base = decodeURIComponent(path.split('/').pop() || 'image')
    return base.includes('.') ? base : base + '.png'
  } catch {
    return `image-${idx + 1}.png`
  }
}

async function downloadList(list) {
  const cap = 100
  const targets = list.slice(0, cap)
  for (let i = 0; i < targets.length; i++) {
    downloading.value = t('image.downloading', { i: i + 1, n: targets.length })
    try {
      await downloadFile(targets[i], fileNameOf(targets[i], i))
    } catch {
      /* skip failures */
    }
    await new Promise((r) => setTimeout(r, 150))
  }
  downloading.value = targets.length ? t('image.downloadStart', { n: targets.length }) : ''
  setTimeout(() => (downloading.value = ''), 3000)
}

function copyUrls() {
  return filtered.value.map((i) => i.url).join('\n')
}

function previewSrc(img) {
  return img.url
}

function isData(img) {
  return img.url.startsWith('data:') || img.url.startsWith('blob:')
}
</script>

<template>
  <ToolShell tool-id="image">
    <template #actions>
      <button class="btn btn-sm" @click="extract">
        <AppIcon name="refresh" :size="13" /> {{ t('image.extract') }}
      </button>
    </template>

    <div class="col">
      <Alert v-if="loadState === 'unsupported'" type="warn">{{ t('cookie.unsupportedUrl') }}</Alert>
      <Alert v-else-if="loadState === 'error'" type="error">
        {{ t('errors.execFail') }}
        <template v-if="errorMsg" #details>{{ errorMsg }}</template>
      </Alert>

      <template v-else>
        <div class="row-wrap">
          <span class="chip">{{ t('image.total', { n: images.length }) }}</span>
          <span class="spacer" />
          <label class="check small">
            <input v-model="loadThumbs" type="checkbox" />
            {{ t('image.loadThumbs') }}
          </label>
        </div>

        <div class="row-wrap">
          <label class="check small">{{ t('image.minWidth') }} <input v-model.number="minW" type="number" class="input num-input" min="0" /></label>
          <label class="check small">{{ t('image.minHeight') }} <input v-model.number="minH" type="number" class="input num-input" min="0" /></label>
          <select v-model="typeFilter" class="select" style="width: 90px">
            <option v-for="ty in types" :key="ty" :value="ty">{{ ty === 'all' ? t('common.all') : ty }}</option>
          </select>
          <span class="spacer" />
          <button class="btn btn-sm" @click="selectAll">{{ t('image.selectAll') }}</button>
          <button class="btn btn-sm" @click="selectNone">{{ t('image.selectNone') }}</button>
        </div>

        <div class="row-wrap">
          <span class="chip">{{ t('common.selectedN', { n: selected.size }) }}</span>
          <span class="spacer" />
          <CopyButton :text="copyUrls" :label="t('image.copyUrls')" />
          <button class="btn btn-sm" :disabled="!filtered.length" @click="downloadList(filtered.map((i) => i.url))">
            <AppIcon name="download" :size="13" /> {{ t('image.downloadAll') }}
          </button>
          <button
            class="btn btn-primary btn-sm"
            :disabled="!selected.size"
            @click="downloadList(filtered.filter((i) => selected.has(i.url)).map((i) => i.url))"
          >
            {{ t('image.downloadSelected') }}
          </button>
        </div>
        <p v-if="downloading" class="tiny muted">{{ downloading }}</p>

        <EmptyState v-if="loadState === 'ok' && !filtered.length" icon="photo" :text="t('image.noImage')" />

        <div v-else class="img-grid">
          <div v-for="(img, i) in filtered.slice(0, 500)" :key="img.url" class="img-card">
            <label class="img-thumb">
              <input
                type="checkbox"
                class="img-check"
                :checked="selected.has(img.url)"
                @change="toggleSelect(img.url)"
              />
              <img
                v-if="loadThumbs"
                :src="previewSrc(img)"
                loading="lazy"
                referrerpolicy="no-referrer"
                alt=""
                @error="$event.target.style.display = 'none'"
              />
              <AppIcon v-else name="photo" :size="22" />
            </label>
            <div class="img-meta">
              <code class="img-name" :title="img.url">{{ img.url.split('/').pop()?.slice(0, 28) || img.url.slice(0, 28) }}</code>
              <div class="row tiny muted" style="gap: 5px">
                <span>{{ img.w || img.h ? t('image.dim', { w: img.w, h: img.h }) : t('image.unknownSize') }}</span>
                <span class="badge other">{{ isData(img) ? t('image.dataUrl') : img.type }}</span>
              </div>
              <div class="img-actions">
                <CopyButton :text="img.url" icon-only />
                <a :href="img.url" target="_blank" rel="noopener" class="btn btn-sm btn-icon" :title="t('image.openTab')">
                  <AppIcon name="external" :size="13" />
                </a>
                <button class="btn btn-sm btn-icon" :title="t('common.download')" @click="downloadList([img.url])">
                  <AppIcon name="download" :size="13" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </ToolShell>
</template>

<style scoped>
.img-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 8px;
}
.img-check { position: absolute; z-index: 1; margin: 4px; }
.img-thumb { position: relative; }
.img-meta {
  padding: 5px 7px 7px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.img-name {
  font-size: 10.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.img-actions { display: flex; gap: 4px; }
.num-input { width: 54px; padding: 2px 6px; }
</style>
