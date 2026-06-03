<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { socket } from 'src/boot/socket'
import { useAoipStore } from 'src/stores/aoip'
import {
  freqToX,
  gainToY,
  xToFreq,
  yToGain,
  useEqCurve,
  EQ_CONSTANTS,
} from 'src/composables/useEqFilter'

const { t } = useI18n()
const aoipStore = useAoipStore()

const props = defineProps({
  channel: Object,
  channelRight: Object,
  channelType: { type: String, default: 'input' },
  hasHpf: { type: Boolean, default: false },
  clipId: { type: String, required: true },
})

const { FREQ_MIN, FREQ_MAX, GAIN_MIN, GAIN_MAX, PL, PT, SVG_W, SVG_H, PW, PH } = EQ_CONSTANTS
const COLORS = ['#ffa726', '#43a047', '#1e88e5', '#8e24aa']
const HPF_COLOR = '#e53935'
const BAND_FREQS = [100, 500, 2000, 12000]
const DEFAULT_BANDS = BAND_FREQS.map((freq) => ({
  enabled: false,
  freq,
  gain: 0,
  q: 0.7,
  type: 'peak',
}))
const BAND_TYPE_OPTIONS = ['low_shelf', 'peak', 'high_shelf']
const BAND_TYPE_LABEL_MAP = { peak: 'Peak', low_shelf: 'Lo Shelf', high_shelf: 'Hi Shelf' }
const FREQ_GRID_MINOR = [
  20, 30, 40, 50, 60, 70, 80, 90, 200, 300, 400, 500, 600, 700, 800, 900, 2000, 3000, 4000, 5000,
  6000, 7000, 8000, 9000, 20000,
]
const FREQ_GRID_MAJOR = [100, 1000, 10000]
const FREQ_LABELS = [50, 100, 200, 500, 1000, 2000, 5000, 10000]
const GAIN_GRID = [-12, -6, 0, 6, 12]
const fmtFL = (f) => (f >= 1000 ? f / 1000 + 'k' : String(f))

const accentColor = computed(() => (props.channelType === 'output' ? '#1e88e5' : '#2979ff'))
const areaFill = computed(() =>
  props.channelType === 'output' ? 'rgba(30,136,229,0.12)' : 'rgba(41,121,255,0.12)',
)

const bands = ref(DEFAULT_BANDS.map((b) => ({ ...b })))
const selectedIdx = ref(0)
const hpfSelected = ref(false)
const hpf = ref({ enabled: false, freq: 80, slope: 12 })
const bypass = ref(false)
let savedEnabled = null
let _isDragging = false
let dragCooldownTimer = null
const DRAG_COOLDOWN_MS = 300
const THROTTLE_MS = 500
const _sendTimers = {}
const _sendLast = {}

function throttledSendBand(i) {
  const now = Date.now(),
    last = _sendLast[i] ?? 0
  clearTimeout(_sendTimers[i])
  if (now - last >= THROTTLE_MS) {
    _sendLast[i] = now
    sendBand(i)
  } else {
    _sendTimers[i] = setTimeout(
      () => {
        _sendLast[i] = Date.now()
        sendBand(i)
      },
      THROTTLE_MS - (now - last),
    )
  }
}
let hpfTimer = null,
  hpfLast = 0
function throttledSendHpf() {
  const now = Date.now()
  clearTimeout(hpfTimer)
  if (now - hpfLast >= THROTTLE_MS) {
    hpfLast = now
    sendHpf()
  } else {
    hpfTimer = setTimeout(
      () => {
        hpfLast = Date.now()
        sendHpf()
      },
      THROTTLE_MS - (now - hpfLast),
    )
  }
}

const { curvePath, areaPath } = useEqCurve(bands, hpf, bypass)
const handles = computed(() =>
  bands.value.map((b, i) => ({
    x: freqToX(Math.max(FREQ_MIN, Math.min(FREQ_MAX, b.freq))),
    y: gainToY(Math.max(GAIN_MIN, Math.min(GAIN_MAX, b.gain))),
    color: COLORS[i],
    enabled: b.enabled,
  })),
)

let svgEl = null
const setSvgRef = (el) => {
  svgEl = el
}
function svgPt(e) {
  if (!svgEl) return { x: 0, y: 0 }
  const r = svgEl.getBoundingClientRect()
  const cx = e.touches?.[0]?.clientX ?? e.clientX
  const cy = e.touches?.[0]?.clientY ?? e.clientY
  return { x: (cx - r.left) * (SVG_W / r.width) - PL, y: (cy - r.top) * (SVG_H / r.height) - PT }
}

function onHandlePointerdown(e, i) {
  e.preventDefault()
  selectedIdx.value = i
  hpfSelected.value = false
  let autoEnabled = false
  if (!bands.value[i].enabled) {
    bands.value[i].enabled = true
    autoEnabled = true
    if (bypass.value) {
      bypass.value = false
      savedEnabled = null
    }
  }
  let moved = false
  clearTimeout(dragCooldownTimer)
  _isDragging = true
  const onMove = (me) => {
    moved = true
    const { x, y } = svgPt(me)
    bands.value[i].freq = Math.round(Math.max(FREQ_MIN, Math.min(FREQ_MAX, xToFreq(x))))
    bands.value[i].gain = Math.round(Math.max(GAIN_MIN, Math.min(GAIN_MAX, yToGain(y))) * 10) / 10
    throttledSendBand(i)
  }
  const onUp = () => {
    if (!moved && autoEnabled) sendBand(i)
    else if (moved) {
      clearTimeout(_sendTimers[i])
      sendBand(i)
    }
    dragCooldownTimer = setTimeout(() => {
      _isDragging = false
    }, DRAG_COOLDOWN_MS)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}
function onHandleWheel(e, i) {
  e.preventDefault()
  bands.value[i].q =
    Math.round(Math.max(0.1, Math.min(10, bands.value[i].q * (e.deltaY > 0 ? 0.9 : 1.1))) * 100) /
    100
  throttledSendBand(i)
}
function onHpfPointerdown(e) {
  e.preventDefault()
  hpfSelected.value = true
  let autoEnabled = false
  if (!hpf.value.enabled) {
    hpf.value.enabled = true
    autoEnabled = true
    if (bypass.value) {
      bypass.value = false
      savedEnabled = null
    }
  }
  _isDragging = true
  clearTimeout(dragCooldownTimer)
  let moved = false
  const onMove = (me) => {
    moved = true
    hpf.value.freq = Math.round(Math.max(20, Math.min(FREQ_MAX, xToFreq(svgPt(me).x))))
    throttledSendHpf()
  }
  const onUp = () => {
    if (!moved && autoEnabled) sendHpf()
    else if (moved) {
      clearTimeout(hpfTimer)
      sendHpf()
    }
    dragCooldownTimer = setTimeout(() => {
      _isDragging = false
    }, DRAG_COOLDOWN_MS)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function sendBand(i) {
  if (!props.channel) return
  const b = bands.value[i]
  if (!isFinite(b.freq) || !isFinite(b.gain) || !isFinite(b.q)) return
  const ids = [props.channel.id, props.channelRight?.id].filter(Boolean)
  const list = props.channelType === 'input' ? aoipStore.channels.inputs : aoipStore.channels.outputs
  for (const id of ids) {
    socket.emit('dsp:eq:band', {
      type: props.channelType,
      id,
      band: i + 1,
      params: { enabled: b.enabled, type: b.type, fc: b.freq, q: b.q, gainDb: b.gain },
    })
    const ch = list.find((c) => c.id === id)
    if (ch) {
      if (!ch.dsp) ch.dsp = {}
      if (!Array.isArray(ch.dsp.eq)) ch.dsp.eq = []
      if (!ch.dsp.eq[i]) ch.dsp.eq[i] = {}
      Object.assign(ch.dsp.eq[i], { enabled: b.enabled, type: b.type, fc: b.freq, q: b.q, gainDb: b.gain })
    }
  }
}
function sendHpf() {
  if (!props.channel) return
  const ids = [props.channel.id, props.channelRight?.id].filter(Boolean)
  const list = props.channelType === 'input' ? aoipStore.channels.inputs : aoipStore.channels.outputs
  for (const id of ids) {
    socket.emit('dsp:hpf', {
      id,
      params: { enabled: hpf.value.enabled, slope: hpf.value.slope, fc: hpf.value.freq },
    })
    const ch = list.find((c) => c.id === id)
    if (ch) {
      if (!ch.dsp) ch.dsp = {}
      ch.dsp.hpf = { enabled: hpf.value.enabled, slope: hpf.value.slope, fc: hpf.value.freq }
    }
  }
}
function toggleHpf() {
  hpf.value.enabled = !hpf.value.enabled
  if (hpf.value.enabled && bypass.value) {
    bypass.value = false
    savedEnabled = null
  }
  sendHpf()
}
function toggleBypass() {
  if (!bypass.value) {
    savedEnabled = { bands: bands.value.map((b) => b.enabled), hpf: hpf.value.enabled }
    bypass.value = true
    bands.value.forEach((b, i) => {
      b.enabled = false
      sendBand(i)
    })
    if (props.hasHpf) {
      hpf.value.enabled = false
      sendHpf()
    }
  } else {
    bypass.value = false
    if (savedEnabled) {
      bands.value.forEach((b, i) => {
        b.enabled = savedEnabled.bands[i]
        sendBand(i)
      })
      if (props.hasHpf) {
        hpf.value.enabled = savedEnabled.hpf
        sendHpf()
      }
      savedEnabled = null
    }
  }
}
function disableHandle(i) {
  bands.value[i].enabled = false
  sendBand(i)
}
function disableHpf() {
  hpf.value.enabled = false
  sendHpf()
}
function commitQ() {
  const n = Number(selBand.value?.q)
  bands.value[selectedIdx.value].q = Math.max(0.1, Math.min(10, isFinite(n) ? n : 1))
  sendBand(selectedIdx.value)
}
function commitFreq() {
  const n = Number(selBand.value?.freq)
  bands.value[selectedIdx.value].freq = Math.round(Math.max(20, Math.min(20000, isFinite(n) ? n : 20)))
  sendBand(selectedIdx.value)
}
function commitGain() {
  const n = Number(selBand.value?.gain)
  bands.value[selectedIdx.value].gain = Math.max(-20, Math.min(20, isFinite(n) ? n : 0))
  sendBand(selectedIdx.value)
}

function allFlat() {
  bands.value.forEach((b, i) => {
    b.gain = 0
    sendBand(i)
  })
}
function toggleHandle(i) {
  bands.value[i].enabled = !bands.value[i].enabled
  if (bands.value[i].enabled && bypass.value) {
    bypass.value = false
    savedEnabled = null
  }
  sendBand(i)
}
function setType(i, type) {
  bands.value[i].type = type
  sendBand(i)
}

const selBand = computed(() => bands.value[selectedIdx.value])

function init(dsp) {
  if (!Array.isArray(dsp?.eq)) return
  bypass.value = dsp.eqBypass ?? false
  savedEnabled = null
  if (props.hasHpf) {
    hpf.value = dsp.hpf
      ? {
          enabled: dsp.hpf.enabled ?? false,
          freq: dsp.hpf.fc ?? dsp.hpf.freq ?? 80,
          slope: dsp.hpf.slope ?? 12,
        }
      : { enabled: false, freq: 80, slope: 12 }
  }
  dsp.eq.forEach((src, i) => {
    if (!bands.value[i]) return
    const def = DEFAULT_BANDS[i]
    const freq = Number(src.fc ?? src.freq),
      gain = Number(src.gainDb ?? src.gain),
      q = Number(src.q)
    Object.assign(bands.value[i], {
      enabled: src.enabled ?? false,
      freq: isFinite(freq) ? freq : def.freq,
      gain: isFinite(gain) ? gain : def.gain,
      q: isFinite(q) && q > 0 ? q : def.q,
      type: src.type ?? src.bandType ?? def.type,
    })
  })
}

watch(
  () => props.channel?.dsp,
  (dsp) => {
    if (!_isDragging && dsp) init(dsp)
  },
  { deep: true, immediate: true },
)

const enabledCount = computed(
  () => bands.value.filter((b) => b.enabled).length + (props.hasHpf && hpf.value.enabled ? 1 : 0),
)

function setHpfFreq(freq) {
  hpf.value.freq = freq
  sendHpf()
}
function setHpfSlope(slope) {
  hpf.value.slope = slope
  sendHpf()
}
const hpfEnabled = computed(() => hpf.value.enabled)

defineExpose({ bypass, enabledCount, hpf, toggleHpf, sendHpf, setHpfFreq, setHpfSlope, hpfEnabled })
</script>

<template>
  <div class="tab-pane">
    <div class="eq-area">
      <div class="eq-toolbar">
        <span class="blk-hdr">EQ</span>
        <div style="margin-left: auto; display: flex; gap: 6px">
          <q-btn
            no-caps
            unelevated
            dense
            size="md"
            style="width: 80px"
            :color="bypass ? 'deep-orange-7' : 'blue-grey-2'"
            :text-color="bypass ? 'white' : 'blue-grey-8'"
            @click="toggleBypass"
            >{{ bypass ? t('mixer.bypass') : t('mixer.active') }}</q-btn
          >
          <q-btn
            no-caps
            unelevated
            dense
            size="md"
            style="width: 80px"
            color="blue-grey-2"
            text-color="blue-grey-8"
            @click="allFlat"
            >{{ t('mixer.flat') }}</q-btn
          >
        </div>
      </div>
      <svg :ref="setSvgRef" :viewBox="`0 0 ${SVG_W} ${SVG_H}`" width="100%" class="eq-svg">
        <rect x="0" y="0" :width="SVG_W" :height="SVG_H" fill="#181b22" />
        <g :transform="`translate(${PL},${PT})`">
          <defs>
            <clipPath :id="clipId"><rect x="0" y="0" :width="PW" :height="PH" /></clipPath>
          </defs>
          <line
            v-for="g in GAIN_GRID"
            :key="'g' + g"
            x1="0"
            :y1="gainToY(g)"
            :x2="PW"
            :y2="gainToY(g)"
            :stroke="g === 0 ? '#374055' : '#252a36'"
            :stroke-width="g === 0 ? 1.5 : 1"
          />
          <line
            v-for="f in FREQ_GRID_MINOR"
            :key="'fm' + f"
            :x1="freqToX(f)"
            y1="0"
            :x2="freqToX(f)"
            :y2="PH"
            stroke="#222633"
            stroke-width="0.75"
          />
          <line
            v-for="f in FREQ_GRID_MAJOR"
            :key="'fM' + f"
            :x1="freqToX(f)"
            y1="0"
            :x2="freqToX(f)"
            :y2="PH"
            stroke="#2d3245"
            stroke-width="1.2"
          />
          <path :d="areaPath" :fill="areaFill" :clip-path="`url(#${clipId})`" />
          <path
            :d="curvePath"
            fill="none"
            :stroke="accentColor"
            stroke-width="2"
            stroke-linejoin="round"
            :clip-path="`url(#${clipId})`"
          />
          <text
            v-for="g in GAIN_GRID"
            :key="'gl' + g"
            x="-5"
            :y="gainToY(g) + 3.5"
            text-anchor="end"
            font-size="9"
            font-weight="600"
            fill="#6a7a9a"
            font-family="monospace"
          >
            {{ g > 0 ? '+' : '' }}{{ g }}
          </text>
          <text
            v-for="f in FREQ_LABELS"
            :key="'fl' + f"
            :x="freqToX(f)"
            :y="PH + 16"
            text-anchor="middle"
            font-size="9"
            font-weight="600"
            fill="#4a5574"
            font-family="sans-serif"
          >
            {{ fmtFL(f) }}
          </text>
          <g v-if="hasHpf" :clip-path="`url(#${clipId})`">
            <g class="band-handle" @pointerdown="onHpfPointerdown" @dblclick.prevent="disableHpf">
              <line
                :x1="freqToX(hpf.freq)"
                y1="0"
                :x2="freqToX(hpf.freq)"
                :y2="PH"
                :stroke="HPF_COLOR"
                stroke-width="1.2"
                stroke-dasharray="4,3"
                opacity="0.5"
              />
              <circle
                :cx="freqToX(hpf.freq)"
                :cy="PH * 0.5"
                r="9"
                :fill="HPF_COLOR"
                :fill-opacity="hpf.enabled ? 0.15 : 0.04"
                :stroke="HPF_COLOR"
                :stroke-width="hpfSelected ? 2 : 1.2"
                :stroke-opacity="hpf.enabled ? 0.9 : 0.3"
              />
              <circle
                :cx="freqToX(hpf.freq)"
                :cy="PH * 0.5"
                r="3.5"
                :fill="HPF_COLOR"
                :fill-opacity="hpf.enabled ? 1 : 0.2"
              />
              <text
                :x="freqToX(hpf.freq)"
                :y="PH * 0.5 - 14"
                text-anchor="middle"
                font-size="8"
                font-weight="700"
                :fill="HPF_COLOR"
                :fill-opacity="hpf.enabled ? 0.9 : 0.4"
                font-family="sans-serif"
              >
                HPF
              </text>
            </g>
          </g>
          <g :clip-path="`url(#${clipId})`">
            <g
              v-for="(h, i) in handles"
              :key="'h' + i"
              :transform="`translate(${h.x.toFixed(1)},${h.y.toFixed(1)})`"
              class="band-handle"
              @pointerdown="onHandlePointerdown($event, i)"
              @dblclick.prevent="disableHandle(i)"
              @wheel.prevent="onHandleWheel($event, i)"
            >
              <circle
                v-if="selectedIdx === i"
                r="14"
                fill="none"
                :stroke="h.color"
                stroke-width="1.2"
                stroke-dasharray="3,2"
                opacity="0.7"
              />
              <circle
                r="9"
                :fill="h.color"
                :fill-opacity="h.enabled ? 0.18 : 0.05"
                :stroke="h.color"
                :stroke-width="selectedIdx === i ? 2 : 1.2"
                :stroke-opacity="h.enabled ? 0.9 : 0.3"
              />
              <circle r="3.5" :fill="h.color" :fill-opacity="h.enabled ? 1 : 0.2" />
              <text
                y="-13"
                text-anchor="middle"
                font-size="9"
                font-weight="700"
                :fill="h.color"
                :fill-opacity="h.enabled ? 0.9 : 0.4"
                font-family="sans-serif"
              >
                {{ i + 1 }}
              </text>
            </g>
          </g>
        </g>
      </svg>
      <div class="eq-bar">
        <div class="band-btns">
          <q-btn
            v-for="(b, i) in bands"
            :key="i"
            no-caps
            unelevated
            dense
            class="band-btn"
            :class="{ 'band-btn--on': b.enabled, 'band-btn--sel': selectedIdx === i }"
            :style="`--bc:${COLORS[i]}`"
            @click="selectedIdx = i"
          >
            <span
              class="band-dot q-mx-xs"
              :style="`background:${COLORS[i]};opacity:${b.enabled ? 1 : 0.35}`"
            />
            <span class="band-num q-mx-xs">{{ i + 1 }}</span>
            <span class="band-freq q-mx-xs">{{
              b.freq >= 1000 ? (b.freq / 1000).toFixed(1) + 'k' : b.freq + 'Hz'
            }}</span>
          </q-btn>
        </div>
        <div v-if="selBand" class="band-pgrid">
          <div class="bpg-item">
            <span class="bpg-lbl">{{ t('common.enable') }}</span>
            <q-toggle
              class="q-mt-sm"
              :model-value="selBand.enabled"
              dense
              size="md"
              color="blue-7"
              @update:model-value="toggleHandle(selectedIdx)"
            />
          </div>
          <div class="bpg-item">
            <span class="bpg-lbl">{{ t('mixer.type') }}</span>
            <q-select
              :model-value="selBand.type"
              :options="BAND_TYPE_OPTIONS.map((opt) => ({ label: BAND_TYPE_LABEL_MAP[opt], value: opt }))"
              emit-value
              map-options
              dense
              outlined
              class="eq-type-sel"
              @update:model-value="(v) => setType(selectedIdx, v)"
            />
          </div>
          <div class="bpg-item">
            <span class="bpg-lbl">{{ t('mixer.q') }}</span>
            <q-input
              v-model.number="selBand.q"
              type="number"
              dense
              outlined
              class="eq-num-inp"
              @blur="commitQ"
              @keydown.enter.prevent="commitQ"
            />
          </div>
          <div class="bpg-item">
            <span class="bpg-lbl">{{ t('mixer.frequency') }}</span>
            <q-input
              v-model.number="selBand.freq"
              type="number"
              dense
              outlined
              suffix="Hz"
              class="eq-num-inp"
              @blur="commitFreq"
              @keydown.enter.prevent="commitFreq"
            />
          </div>
          <div class="bpg-item">
            <span class="bpg-lbl">{{ t('mixer.gain') }}</span>
            <q-input
              v-model.number="selBand.gain"
              type="number"
              dense
              outlined
              suffix="dB"
              class="eq-num-inp"
              @blur="commitGain"
              @keydown.enter.prevent="commitGain"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}
.eq-area {
  padding: 10px 14px 0;
  overflow-y: auto;
}
.eq-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.blk-hdr {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.6px;
  color: #5a6a8a;
  text-transform: uppercase;
}
.eq-svg {
  display: block;
  user-select: none;
  border-radius: 6px;
}
.band-handle {
  cursor: grab;
}
.band-handle:active {
  cursor: grabbing;
}

.eq-bar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px 18px;
  margin-top: 10px;
  background: #eaecf3;
  border-top: 1px solid #d0d8e8;
}
.band-btns {
  display: flex;
  gap: 5px;
}
.band-btn {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 5px 8px;
  border: 1px solid #c8d2e4;
  border-radius: 6px;
  background: #f4f6fb;
  cursor: pointer;
  color: #7a8aaa;
  transition: all 0.1s;
}
.band-btn:hover {
  border-color: var(--bc);
  color: #1e2840;
}
.band-btn--sel {
  border-color: var(--bc);
  color: #1e2840;
  background: #eef2ff;
  box-shadow: 0 0 0 1.5px var(--bc);
}
.band-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.band-num {
  font-size: 16px;
  font-weight: 700;
}
.band-freq {
  font-size: 12px;
  color: #8a9ab4;
  font-family: monospace;
  padding-top: 2px;
}
.band-pgrid {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 10px;
  flex-wrap: nowrap;
}
.bpg-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  min-width: 0;
}
.bpg-lbl {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: #7a8aa4;
  text-transform: uppercase;
  text-align: center;
}
.eq-num-inp {
  width: 120px;
}
.eq-num-inp :deep(.q-field__control) {
  height: 28px;
  background: #ffffff;
  align-items: center;
}
.eq-num-inp :deep(input) {
  font-size: 16px;
  font-family: 'Courier New', monospace;
  text-align: center;
  color: #1e2840;
  appearance: textfield;
  -moz-appearance: textfield;
}
.eq-num-inp :deep(input::-webkit-inner-spin-button) {
  display: none;
}
.eq-num-inp :deep(.q-field__suffix) {
  font-size: 12px;
  color: #8a9ab4;
}
.eq-type-sel {
  width: 120px;
}
.eq-type-sel :deep(.q-field__control) {
  height: 28px;
  background: #ffffff;
  min-height: unset;
}
.eq-type-sel :deep(.q-field__native) {
  font-size: 14px;
  color: #1e2840;
  min-height: unset;
  text-align: center;
}
</style>
