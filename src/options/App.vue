<script setup>
import { ref } from 'vue'
import AppIcon from '../ui/AppIcon.vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import { settings, resetSettings } from '../utils/settings'
import { t } from '../utils/i18n'
import { copyText } from '../utils/clipboard'
import { TOOLS } from '../utils/tools'

const resetDone = ref(false)
const copiedShortcuts = ref(false)

async function doReset() {
  if (!confirm(t('options.resetBtn') + '?')) return
  await resetSettings()
  resetDone.value = true
  setTimeout(() => (resetDone.value = false), 2000)
}

async function copyShortcutsUrl() {
  await copyText('chrome://extensions/shortcuts')
  copiedShortcuts.value = true
  setTimeout(() => (copiedShortcuts.value = false), 1500)
}
</script>

<template>
  <div class="wrap">
    <header class="head">
      <div class="row">
        <span class="logo"><AppIcon name="zap" :size="15" /></span>
        <h1>{{ t('options.title') }}</h1>
      </div>
      <ThemeToggle />
    </header>

    <main class="col main">
      <section class="panel col">
        <b>{{ t('options.appearance') }}</b>
        <div class="row-wrap">
          <span class="muted small">{{ t('options.themeLabel') }}</span>
          <div class="seg">
            <button class="btn btn-sm" :class="{ 'btn-primary': settings.theme === 'auto' }" @click="settings.theme = 'auto'">
              {{ t('common.auto') }}
            </button>
            <button class="btn btn-sm" :class="{ 'btn-primary': settings.theme === 'light' }" @click="settings.theme = 'light'">
              {{ t('common.light') }}
            </button>
            <button class="btn btn-sm" :class="{ 'btn-primary': settings.theme === 'dark' }" @click="settings.theme = 'dark'">
              {{ t('common.dark') }}
            </button>
          </div>
        </div>
        <div class="row-wrap">
          <span class="muted small">{{ t('options.localeLabel') }}</span>
          <div class="seg">
            <button class="btn btn-sm" :class="{ 'btn-primary': settings.locale === 'auto' }" @click="settings.locale = 'auto'">
              {{ t('common.auto') }}
            </button>
            <button class="btn btn-sm" :class="{ 'btn-primary': settings.locale === 'zh' }" @click="settings.locale = 'zh'">
              中文
            </button>
            <button class="btn btn-sm" :class="{ 'btn-primary': settings.locale === 'en' }" @click="settings.locale = 'en'">
              English
            </button>
          </div>
        </div>
      </section>

      <section class="panel col">
        <b>{{ t('options.behavior') }}</b>
        <div class="row-wrap">
          <span class="muted small">{{ t('options.jsonIndentLabel') }}</span>
          <div class="seg">
            <button v-for="opt in ['2', '4', 'tab']" :key="opt" class="btn btn-sm" :class="{ 'btn-primary': settings.jsonIndent === opt }" @click="settings.jsonIndent = opt">
              {{ opt === 'tab' ? 'Tab' : opt }}
            </button>
          </div>
        </div>
        <div class="row-wrap">
          <span class="muted small">{{ t('options.reqBufferLabel') }}</span>
          <select v-model.number="settings.reqBufferSize" class="select" style="width: 100px">
            <option :value="50">50</option>
            <option :value="100">100</option>
            <option :value="200">200</option>
            <option :value="500">500</option>
          </select>
        </div>
        <label class="check">
          <input v-model="settings.imageThumbs" type="checkbox" />
          {{ t('options.thumbsLabel') }}
        </label>
      </section>

      <section class="panel col">
        <b>{{ t('options.shortcuts') }}</b>
        <table class="table">
          <thead>
            <tr>
              <th style="width: 30%"></th>
              <th>{{ t('options.shortcutGlobal') }}</th>
              <th>{{ t('options.shortcutInApp') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{{ t('options.scOpenPopup') }}</td>
              <td><span class="kbd">Alt+Shift+D</span></td>
              <td>—</td>
            </tr>
            <tr>
              <td>{{ t('options.scOpenPanel') }}</td>
              <td><span class="kbd">Alt+Shift+S</span></td>
              <td>—</td>
            </tr>
            <tr>
              <td>{{ t('options.scSwitchTool') }}</td>
              <td>—</td>
              <td><span class="kbd">Alt+1…9</span> <span class="kbd">Alt+0</span></td>
            </tr>
            <tr>
              <td>{{ t('options.scFormat') }}</td>
              <td>—</td>
              <td><span class="kbd">Ctrl/⌘+Enter</span></td>
            </tr>
          </tbody>
        </table>
        <p class="tiny muted">{{ t('options.shortcutsHint') }}</p>
        <button class="btn btn-sm" style="align-self: flex-start" @click="copyShortcutsUrl">
          <AppIcon name="copy" :size="12" />
          {{ copiedShortcuts ? t('common.copied') : 'chrome://extensions/shortcuts' }}
        </button>
      </section>

      <section class="panel col">
        <b>{{ t('options.privacy') }}</b>
        <p class="small soft">{{ t('options.privacyText') }}</p>
        <p class="tiny muted">
          {{ t('options.storageEngine') }}: {{ t('options.storageEngineValue') }}
        </p>
        <div class="row">
          <button class="btn btn-danger btn-sm" @click="doReset">{{ t('options.resetBtn') }}</button>
          <span v-if="resetDone" class="badge ok">{{ t('options.resetDone') }}</span>
        </div>
      </section>
    </main>

    <footer class="foot tiny muted">
      Dev Quick Assistant · v1.0.0 · MIT · {{ TOOLS.length }} {{ t('sidepanel.tabs') }}
    </footer>
  </div>
</template>

<style scoped>
.wrap {
  max-width: 680px;
  margin: 0 auto;
  padding: 18px 16px 30px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 100%;
}
.head { display: flex; align-items: center; justify-content: space-between; }
.head .logo {
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 9px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
}
.head h1 { font-size: 17px; }
.seg { display: inline-flex; gap: 4px; }
.foot { text-align: center; padding-top: 8px; }
</style>
