<script setup>
import { ref, computed, watch } from 'vue'
import ToolShell from '../components/ToolShell.vue'
import Alert from '../components/Alert.vue'
import CopyButton from '../components/CopyButton.vue'
import { t } from '../utils/i18n'
import {
  parseColor,
  rgbToHex,
  formatRgb,
  formatRgba,
  formatHsl,
  formatHsla,
  rgbToHsv,
  rgbToHsl,
  hslToRgb,
  contrastRatio,
  bestTextColor,
  shadeScale,
  withAlpha
} from '../core/color'

const input = ref('#4F5FD5')
const alpha = ref(1)

const parsed = computed(() => parseColor(input.value))
const withA = computed(() => (parsed.value ? withAlpha(parsed.value, alpha.value) : null))

const outputs = computed(() => {
  const c = withA.value
  if (!c) return []
  return [
    { label: 'HEX', value: rgbToHex(c) },
    { label: 'RGB', value: formatRgb(c) },
    { label: 'RGBA', value: formatRgba(c) },
    { label: 'HSL', value: formatHsl(c) },
    { label: 'HSLA', value: formatHsla(c) },
    {
      label: 'HSV',
      value: (() => {
        const { h, s, v } = rgbToHsv(c)
        return `hsv(${h}, ${s}%, ${v}%)`
      })()
    }
  ]
})

const contrast = computed(() => {
  const c = withA.value
  if (!c) return null
  const opaque = { r: c.r, g: c.g, b: c.b }
  const vsWhite = contrastRatio(opaque, { r: 255, g: 255, b: 255 })
  const vsBlack = contrastRatio(opaque, { r: 0, g: 0, b: 0 })
  const badge = (r) => (r >= 7 ? 'aaa' : r >= 4.5 ? 'aa' : r >= 3 ? 'aaLarge' : 'failAA')
  return {
    vsWhite,
    vsBlack,
    whiteBadge: badge(vsWhite),
    blackBadge: badge(vsBlack),
    best: bestTextColor(opaque)
  }
})

const scale = computed(() => {
  const c = parsed.value
  if (!c) return []
  return shadeScale(c)
})

function onPicker(e) {
  input.value = e.target.value
  alpha.value = 1
}

function syncSlider() {
  // keep in range when user edits color text
  if (alpha.value == null || Number.isNaN(alpha.value)) alpha.value = 1
}

const hslForSlider = computed(() => (parsed.value ? rgbToHsl(parsed.value) : { h: 0, s: 0, l: 50 }))
const sliderColor = computed(() => rgbToHex(hslToRgb(hslForSlider.value.h, hslForSlider.value.s, 50)))
</script>

<template>
  <ToolShell tool-id="color">
    <div class="col">
      <div class="panel col">
        <div class="row-wrap">
          <b class="small">{{ t('color.input') }}</b>
          <input v-model="input" class="input mono grow" :placeholder="t('color.inputPlaceholder')" spellcheck="false" />
          <label class="row" :title="t('color.picker')">
            <input type="color" :value="parsed ? rgbToHex(parsed).slice(0, 7) : '#4f5fd5'" @input="onPicker" />
          </label>
        </div>
        <div class="row-wrap">
          <span class="tiny muted">{{ t('color.alpha') }}</span>
          <input
            v-model.number="alpha"
            type="range"
            min="0"
            max="1"
            step="0.01"
            class="grow"
            :style="{ accentColor: sliderColor }"
            @change="syncSlider"
          />
          <span class="mono tiny" style="width: 34px">{{ alpha.toFixed(2) }}</span>
          <div class="swatch" :style="{ width: '42px', height: '26px' }">
            <div
              v-if="withA"
              :style="{
                width: '100%', height: '100%', borderRadius: '5px',
                background: `rgba(${withA.r}, ${withA.g}, ${withA.b}, ${withA.a})`
              }"
            />
          </div>
        </div>
        <Alert v-if="input && !parsed" type="error" dense>{{ t('color.invalid') }}</Alert>
      </div>

      <div v-if="withA" class="panel col">
        <b class="small">{{ t('color.formats') }}</b>
        <div class="fmt-grid">
          <div v-for="o in outputs" :key="o.label" class="fmt-row" @click="() => {}">
            <span class="badge other">{{ o.label }}</span>
            <code class="grow break-all">{{ o.value }}</code>
            <CopyButton :text="o.value" icon-only />
          </div>
        </div>
      </div>

      <div v-if="contrast" class="panel col">
        <b class="small">{{ t('color.contrast') }}</b>
        <div class="contrast-grid">
          <div class="contrast-card" :style="{ background: '#ffffff' }">
            <span :style="{ color: `rgb(${withA.r},${withA.g},${withA.b})`, fontWeight: 700 }">Aa 文字预览</span>
            <span class="tiny" :style="{ color: '#333' }">{{ t('color.vsWhite') }}: {{ contrast.vsWhite }}</span>
            <span class="badge" :class="contrast.whiteBadge === 'failAA' ? 'err' : 'ok'">{{ t('color.' + contrast.whiteBadge) }}</span>
          </div>
          <div class="contrast-card" :style="{ background: '#000000' }">
            <span :style="{ color: `rgb(${withA.r},${withA.g},${withA.b})`, fontWeight: 700 }">Aa 文字预览</span>
            <span class="tiny" :style="{ color: '#ccc' }">{{ t('color.vsBlack') }}: {{ contrast.vsBlack }}</span>
            <span class="badge" :class="contrast.blackBadge === 'failAA' ? 'err' : 'ok'">{{ t('color.' + contrast.blackBadge) }}</span>
          </div>
        </div>
        <div class="row tiny muted">
          {{ t('color.bestText') }}: <code>{{ contrast.best }}</code>
          <CopyButton :text="contrast.best" icon-only />
        </div>
      </div>

      <div v-if="scale.length" class="panel col">
        <b class="small">{{ t('color.scale') }}</b>
        <div class="scale-row">
          <button
            v-for="s in scale"
            :key="s.level"
            class="scale-swatch"
            :style="{ background: s.hex, color: s.level >= 60 ? '#fff' : '#000' }"
            :title="`${s.level} · ${s.hex}`"
            type="button"
            @click="input = s.hex"
          >
            <span class="tiny">{{ s.level }}</span>
          </button>
        </div>
      </div>
    </div>
  </ToolShell>
</template>

<style scoped>
.fmt-grid { display: flex; flex-direction: column; gap: 4px; }
.fmt-row {
  display: flex; align-items: center; gap: 8px;
  padding: 3px 6px; border-radius: 5px;
}
.fmt-row:hover { background: var(--bg-hover); }
.fmt-row .badge { width: 52px; justify-content: center; flex: none; }
.contrast-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.contrast-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px;
  display: flex; flex-direction: column; gap: 5px; align-items: flex-start;
}
.scale-row { display: flex; gap: 4px; }
.scale-swatch {
  flex: 1; height: 40px; border: 1px solid var(--border);
  border-radius: 5px; cursor: pointer; display: flex; align-items: flex-end;
  justify-content: center; padding-bottom: 3px; border: 0;
}
.scale-swatch:hover { outline: 2px solid var(--accent); }
</style>
