<script setup>
import { ref, computed, watch } from 'vue'
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

const aoipStore = useAoipStore()

const props = defineProps({
  modelValue: Boolean,
  channel: Object, // 기준 채널 (mono 또는 stereo left)
  channelRight: Object, // 스테레오 right 채널 (없으면 null)
  channelType: String, // 'input' | 'output'
})
const emit = defineEmits(['update:modelValue'])

// ── Constants ──────────────────────────────────────────────
const { FREQ_MIN, FREQ_MAX, GAIN_MIN, GAIN_MAX, PL, PT, SVG_W, SVG_H, PW, PH } = EQ_CONSTANTS

const COLORS = ['#ffa726', '#66bb6a', '#42a5f5', '#ab47bc']
const BAND_LABELS = ['Band 1', 'Band 2', 'Band 3', 'Band 4']

const HPF_COLOR = '#ef5350'
const HPF_SLOPES = [12, 24, 48]

// 밴드별 기본 주파수 배열
const BAND_FREQS = [100, 500, 2000, 12000]
const DEFAULT_BANDS = BAND_FREQS.map((freq) => ({
  enabled: false,
  freq,
  gain: 0,
  q: 0.7,
  type: 'peak',
}))
// 모든 밴드가 세 가지 필터 타입 지원
const BAND_TYPE_OPTIONS = ['low_shelf', 'peak', 'high_shelf']

// ── State ──────────────────────────────────────────────────
const bands = ref(DEFAULT_BANDS.map((b) => ({ ...b })))
const selectedIdx = ref(0)
const hpfSelected = ref(false)
const hpf = ref({ enabled: false, freq: 80, slope: 12 })
const bypass = ref(false)
// bypass 토글 전 enabled 상태 저장
let savedEnabled = null
// 드래그 중 + 종료 후 쿨다운 동안 백엔드 업데이트 무시
let isDragging = false
let dragCooldownTimer = null
const DRAG_COOLDOWN_MS = 300

// ── Throttle helpers ───────────────────────────────────────
const THROTTLE_MS = 100
const _sendTimers = {}
const _sendLast = {}

function throttledSendBand(bandIdx) {
  const now = Date.now()
  const last = _sendLast[bandIdx] ?? 0
  clearTimeout(_sendTimers[bandIdx])
  if (now - last >= THROTTLE_MS) {
    _sendLast[bandIdx] = now
    sendBand(bandIdx)
  } else {
    _sendTimers[bandIdx] = setTimeout(
      () => {
        _sendLast[bandIdx] = Date.now()
        sendBand(bandIdx)
      },
      THROTTLE_MS - (now - last),
    )
  }
}

function initFromChannel() {
  if (!props.channel) return
  bypass.value = false
  savedEnabled = null
  const dsp = props.channel.dsp
  if (Array.isArray(dsp?.eq)) {
    dsp.eq.forEach((src, i) => {
      if (!bands.value[i]) return
      const def = DEFAULT_BANDS[i]
      const freq = Number(src.fc ?? src.freq)
      const gain = Number(src.gainDb ?? src.gain)
      const q = Number(src.q)
      Object.assign(bands.value[i], {
        enabled: src.enabled ?? false,
        freq: isFinite(freq) ? freq : def.freq,
        gain: isFinite(gain) ? gain : def.gain,
        q: isFinite(q) && q > 0 ? q : def.q,
        type: src.type ?? src.bandType ?? def.type,
      })
    })
  } else {
    bands.value = DEFAULT_BANDS.map((b) => ({ ...b }))
  }
  if (dsp?.hpf) {
    hpf.value = {
      enabled: dsp.hpf.enabled ?? false,
      freq: dsp.hpf.fc ?? dsp.hpf.freq ?? 80,
      slope: dsp.hpf.slope ?? 12,
    }
  } else {
    hpf.value = { enabled: false, freq: 80, slope: 12 }
  }
}

watch(
  () => props.modelValue,
  (v) => {
    if (v) initFromChannel()
  },
)
watch(
  () => props.channel?.dsp,
  () => {
    if (!isDragging) initFromChannel()
  },
  { deep: true },
)

// ── SVG layout constants imported from useEqFilter ────────────

// ── EQ Curve calculation ───────────────────────────────────
const { curvePath, areaPath } = useEqCurve(bands, hpf, bypass)

// ── HPF throttle & send ────────────────────────────────────
let hpfThrottleTimer = null
let hpfLastSend = 0

function throttledSendHpf() {
  const now = Date.now()
  clearTimeout(hpfThrottleTimer)
  if (now - hpfLastSend >= THROTTLE_MS) {
    hpfLastSend = now
    sendHpf()
  } else {
    hpfThrottleTimer = setTimeout(
      () => {
        hpfLastSend = Date.now()
        sendHpf()
      },
      THROTTLE_MS - (now - hpfLastSend),
    )
  }
}

function sendHpf() {
  if (!props.channel) return
  const ids = [props.channel?.id, props.channelRight?.id].filter(Boolean)
  const params = { enabled: hpf.value.enabled, slope: hpf.value.slope, fc: hpf.value.freq }
  for (const id of ids) {
    socket.emit('dsp:hpf', { id, params })
    const allChs = [...aoipStore.channels.inputs, ...aoipStore.channels.outputs]
    const ch = allChs.find((c) => c.id === id)
    if (ch?.dsp) ch.dsp.hpf = { enabled: params.enabled, slope: params.slope, fc: params.fc }
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

  isDragging = true
  clearTimeout(dragCooldownTimer)
  let moved = false
  const onMove = (me) => {
    moved = true
    const { x } = svgPt(me)
    hpf.value.freq = Math.round(Math.max(20, Math.min(FREQ_MAX, xToFreq(x))))
    throttledSendHpf()
  }
  const onUp = () => {
    if (!moved && autoEnabled) sendHpf()
    else if (moved) {
      clearTimeout(hpfThrottleTimer)
      sendHpf()
    }
    dragCooldownTimer = setTimeout(() => {
      isDragging = false
    }, DRAG_COOLDOWN_MS)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function setHpfFreq(val) {
  hpf.value.freq = Math.round(Math.max(20, Math.min(FREQ_MAX, Number(val) || 80)))
  throttledSendHpf()
}

// ── EQ Curve from useEqCurve composable ────────────────────

// ── Band handles (0-3 = peak bands) ───────────────────────
const handles = computed(() => {
  return bands.value.map((b, i) => ({
    x: freqToX(Math.max(FREQ_MIN, Math.min(FREQ_MAX, b.freq))),
    y: gainToY(Math.max(GAIN_MIN, Math.min(GAIN_MAX, b.gain))),
    color: COLORS[i],
    enabled: b.enabled,
  }))
})

// ── Grid ───────────────────────────────────────────────────
// 매 decade 내 모든 정수배 (20~20kHz)
const FREQ_GRID_MINOR = [
  20, 30, 40, 50, 60, 70, 80, 90, 200, 300, 400, 500, 600, 700, 800, 900, 2000, 3000, 4000, 5000,
  6000, 7000, 8000, 9000, 20000,
]
const FREQ_GRID_MAJOR = [100, 1000, 10000]
const FREQ_LABELS = [50, 100, 200, 500, 1000, 2000, 5000, 10000]
const GAIN_GRID = [-12, -6, 0, 6, 12]
function fmtFL(f) {
  return f >= 1000 ? f / 1000 + 'k' : f + ''
}

// ── Drag ───────────────────────────────────────────────────
let svgEl = null
function setSvgRef(el) {
  svgEl = el
}

function svgPt(e) {
  if (!svgEl) return { x: 0, y: 0 }
  const r = svgEl.getBoundingClientRect()
  const sx = SVG_W / r.width,
    sy = SVG_H / r.height
  const cx = e.touches?.[0]?.clientX ?? e.clientX
  const cy = e.touches?.[0]?.clientY ?? e.clientY
  return { x: (cx - r.left) * sx - PL, y: (cy - r.top) * sy - PT }
}

function onHandlePointerdown(e, i) {
  e.preventDefault()
  selectedIdx.value = i
  hpfSelected.value = false

  // 드래그 시작 시 해당 밴드 자동 ON
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
  isDragging = true
  const onMove = (me) => {
    moved = true
    const { x, y } = svgPt(me)
    const b = bands.value[i]
    b.freq = Math.round(Math.max(FREQ_MIN, Math.min(FREQ_MAX, xToFreq(x))))
    b.gain = Math.round(Math.max(GAIN_MIN, Math.min(GAIN_MAX, yToGain(y))) * 10) / 10
    throttledSendBand(i)
  }
  const onUp = () => {
    if (!moved) {
      if (autoEnabled) sendBand(i)
    } else {
      clearTimeout(_sendTimers[i])
      sendBand(i)
    }
    dragCooldownTimer = setTimeout(() => {
      isDragging = false
    }, DRAG_COOLDOWN_MS)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function onHandleWheel(e, i) {
  e.preventDefault()
  const b = bands.value[i]
  b.q = Math.round(Math.max(0.1, Math.min(10, b.q * (e.deltaY > 0 ? 0.9 : 1.1))) * 100) / 100
  throttledSendBand(i)
}

// ── Socket helpers ─────────────────────────────────────────
// 스테레오일 때 left + right 양쪽 동시 전송
function emitEq(payload) {
  const ids = [props.channel?.id, props.channelRight?.id].filter(Boolean)
  for (const id of ids) {
    socket.emit('dsp:eq:band', {
      type: props.channelType,
      id,
      band: payload.band,
      params: {
        enabled: payload.enabled,
        type: payload.bandType,
        fc: payload.freq,
        q: payload.q,
        gainDb: payload.gain,
      },
    })
  }
}

function sendBand(bandIdx) {
  if (!props.channel) return
  const b = bands.value[bandIdx]
  if (!isFinite(b.freq) || !isFinite(b.gain) || !isFinite(b.q)) return
  emitEq({
    band: bandIdx + 1,
    enabled: b.enabled,
    freq: b.freq,
    gain: b.gain,
    q: b.q,
    bandType: b.type,
  })
}

function toggleBypass() {
  if (!bypass.value) {
    // 바이패스 ON: 현재 enabled 상태 저장 후 전체 비활성화
    savedEnabled = { bands: bands.value.map((b) => b.enabled), hpf: hpf.value.enabled }
    bypass.value = true
    bands.value.forEach((b, idx) => {
      b.enabled = false
      sendBand(idx)
    })
    hpf.value.enabled = false
    sendHpf()
  } else {
    // 바이패스 OFF: 저장된 상태 복원 + 전체 계수 재전송
    bypass.value = false
    if (savedEnabled) {
      bands.value.forEach((b, idx) => {
        b.enabled = savedEnabled.bands[idx]
        sendBand(idx)
      })
      hpf.value.enabled = savedEnabled.hpf
      sendHpf()
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

function allFlat() {
  bands.value.forEach((b, idx) => {
    b.gain = 0
    sendBand(idx)
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

// ── Type setting for convertible bands ────────────────────
function setType(bandIdx, type) {
  const b = bands.value[bandIdx]
  b.type = type
  sendBand(bandIdx)
}

// ── Selected band accessors ────────────────────────────────
const selBandIdx = computed(() => selectedIdx.value)
const selBand = computed(() => bands.value[selBandIdx.value])
const selIsShelf = computed(
  () => selBand.value?.type === 'low_shelf' || selBand.value?.type === 'high_shelf',
)
const selEnabled = computed(() => selBand.value?.enabled ?? false)
const selColor = computed(() => COLORS[selectedIdx.value])
const selTypeOptions = BAND_TYPE_OPTIONS

const BAND_TYPE_LABEL_MAP = {
  peak: 'Peak',
  low_shelf: 'Low Shelf',
  high_shelf: 'Hi Shelf',
}

// ── Band control definitions ───────────────────────────────
const bandControlDefs = [
  { key: 'freq', label: 'Frequency', unit: 'Hz', min: 20, max: 20000, step: 1 },
  { key: 'gain', label: 'Gain', unit: 'dB', min: -15, max: 15, step: 0.5 },
  { key: 'q', label: 'Q', unit: 'oct', min: 0.1, max: 10, step: 0.05, isShelfLabel: 'Slope' },
]

const hpfControlDefs = [
  { key: 'freq', label: 'Frequency', unit: 'Hz', min: 20, max: 2000, step: 1 },
  { key: 'slope', label: 'Slope', unit: '', isButtonGroup: true, options: HPF_SLOPES },
]

function safe(val, def) {
  const n = Number(val)
  return isFinite(n) ? n : def
}

function setFreq(val) {
  if (!selBand.value) return
  selBand.value.freq = Math.round(Math.max(FREQ_MIN, Math.min(FREQ_MAX, Number(val) || FREQ_MIN)))
  throttledSendBand(selectedIdx.value)
}
function setGain(val) {
  if (!selBand.value) return
  selBand.value.gain = Math.max(GAIN_MIN, Math.min(GAIN_MAX, Number(val) || 0))
  throttledSendBand(selectedIdx.value)
}
function setQ(val) {
  if (!selBand.value) return
  selBand.value.q = Math.max(0.1, Math.min(10, Number(val) || 1))
  throttledSendBand(selectedIdx.value)
}

// ── v-model helpers for q-input ──────────────────────────
const bandFreqModel = computed({
  get: () => safe(selBand.value?.freq, DEFAULT_BANDS[selBandIdx.value]?.freq ?? 100),
  set: (val) => setFreq(val),
})
const bandGainModel = computed({
  get: () => safe(selBand.value?.gain, 0),
  set: (val) => setGain(val),
})
const bandQModel = computed({
  get: () => safe(selBand.value?.q, 1),
  set: (val) => setQ(val),
})
const hpfFreqModel = computed({
  get: () => safe(hpf.value.freq, 80),
  set: (val) => setHpfFreq(val),
})
</script>

<template>
  <q-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <q-card class="eq-card">
      <!-- Header -->
      <q-card-section class="row items-center no-wrap q-py-sm q-px-md q-gutter-x-sm">
        <q-icon name="equalizer" size="1.4rem" color="blue-grey-5" class="q-mr-xs" />
        <span class="item-title">EQ</span>
        <span class="chname">{{
          channelRight
            ? channel?.label?.replace(/\s*(CH\d+|[LR]|\d+)$/i, '').trim()
            : channel?.label
        }}</span>
        <q-space />
        <q-btn flat round dense icon="close" size="sm" @click="emit('update:modelValue', false)" />
      </q-card-section>

      <q-separator />

      <q-card-section class="q-pt-sm q-pb-md">
        <!-- SVG display -->
        <svg :ref="setSvgRef" :viewBox="`0 0 ${SVG_W} ${SVG_H}`" width="100%" class="eq-svg">
          <g :transform="`translate(${PL},${PT})`">
            <defs>
              <clipPath id="eq-plot-clip">
                <rect x="0" y="0" :width="PW" :height="PH" />
              </clipPath>
            </defs>
            <rect x="0" y="0" :width="PW" :height="PH" fill="#202025" rx="0" />

            <!-- Gain grid -->
            <line
              v-for="g in GAIN_GRID"
              :key="'g' + g"
              x1="0"
              :y1="gainToY(g)"
              :x2="PW"
              :y2="gainToY(g)"
              :stroke="g === 0 ? '#3a3a4a' : '#1a1a2a'"
              :stroke-width="g === 0 ? 1.5 : 1"
            />
            <!-- Freq grid minor -->
            <line
              v-for="f in FREQ_GRID_MINOR"
              :key="'fm' + f"
              :x1="freqToX(f)"
              y1="0"
              :x2="freqToX(f)"
              :y2="PH"
              stroke="#222233"
              stroke-width="0.75"
            />
            <!-- Freq grid major -->
            <line
              v-for="f in FREQ_GRID_MAJOR"
              :key="'fM' + f"
              :x1="freqToX(f)"
              y1="0"
              :x2="freqToX(f)"
              :y2="PH"
              stroke="#2e2e42"
              stroke-width="1.2"
            />

            <!-- Area fill -->
            <path :d="areaPath" fill="rgba(66,165,245,0.09)" clip-path="url(#eq-plot-clip)" />
            <!-- Response curve -->
            <path
              :d="curvePath"
              fill="none"
              stroke="#42a5f5"
              stroke-width="2"
              stroke-linejoin="round"
              clip-path="url(#eq-plot-clip)"
            />

            <!-- Gain labels -->
            <text
              v-for="g in GAIN_GRID"
              :key="'gl' + g"
              :x="-4"
              :y="gainToY(g) + 3.5"
              text-anchor="end"
              font-size="9"
              font-weight="700"
              fill="#000"
            >
              {{ g > 0 ? '+' : '' }}{{ g }}
            </text>
            <!-- Freq labels -->
            <text
              v-for="f in FREQ_LABELS"
              :key="'fl' + f"
              :x="freqToX(f)"
              :y="PH + 16"
              text-anchor="middle"
              font-size="9"
              font-weight="700"
              fill="#000"
              font-family="sans-serif"
            >
              {{ fmtFL(f) }}
            </text>

            <!-- HPF handle -->
            <g clip-path="url(#eq-plot-clip)">
              <g
                class="band-handle"
                @pointerdown="onHpfPointerdown"
                @dblclick.prevent="disableHpf"
              >
                <line
                  :x1="freqToX(hpf.freq)"
                  y1="0"
                  :x2="freqToX(hpf.freq)"
                  :y2="PH"
                  :stroke="HPF_COLOR"
                  stroke-width="1.5"
                  stroke-dasharray="4,2"
                  opacity="0.65"
                />
                <circle
                  :cx="freqToX(hpf.freq)"
                  :cy="PH * 0.5"
                  r="9"
                  :fill="HPF_COLOR"
                  :fill-opacity="hpf.enabled ? 0.22 : 0.06"
                  :stroke="HPF_COLOR"
                  :stroke-width="hpfSelected ? 2.5 : 1.5"
                  :stroke-opacity="hpf.enabled ? 1 : 0.35"
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
                  :fill-opacity="hpf.enabled ? 1 : 0.5"
                  font-family="sans-serif"
                >
                  HPF
                </text>
              </g>
            </g>

            <!-- Band handles -->
            <g clip-path="url(#eq-plot-clip)">
              <g
                v-for="(h, i) in handles"
                :key="'h' + i"
                :transform="`translate(${h.x.toFixed(1)},${h.y.toFixed(1)})`"
                class="band-handle"
                @pointerdown="onHandlePointerdown($event, i)"
                @dblclick.prevent="disableHandle(i)"
                @wheel.prevent="onHandleWheel($event, i)"
              >
                <!-- Selection ring -->
                <circle
                  v-if="selectedIdx === i"
                  r="14"
                  fill="none"
                  :stroke="h.color"
                  stroke-width="1.5"
                  stroke-dasharray="3,2"
                  opacity="0.8"
                />
                <circle
                  r="9"
                  :fill="h.color"
                  :fill-opacity="h.enabled ? 0.22 : 0.06"
                  :stroke="h.color"
                  :stroke-width="selectedIdx === i ? 2.5 : 1.5"
                  :stroke-opacity="h.enabled ? 1 : 0.35"
                />
                <circle r="3.5" :fill="h.color" :fill-opacity="h.enabled ? 1 : 0.2" />
                <text
                  y="-14"
                  text-anchor="middle"
                  font-size="8"
                  font-weight="700"
                  :fill="h.color"
                  :fill-opacity="h.enabled ? 1 : 0.5"
                  font-family="sans-serif"
                >
                  {{ i + 1 }}
                </text>
              </g>
            </g>
          </g>
        </svg>

        <!-- Band selector -->
        <div class="row q-mt-sm q-gutter-xs items-center justify-center">
          <!-- 전체 바이패스 -->
          <div
            class="band-pill bypass-pill"
            :class="{ 'bypass-pill--on': bypass }"
            @click="toggleBypass"
          >
            <q-icon
              :name="bypass ? 'block' : 'check_circle'"
              size="14px"
              :style="`color: ${bypass ? '#f57c00' : '#42a5f5'}`"
            />
            <span class="bp-label">{{ bypass ? 'BYPASS' : 'ACTIVE' }}</span>
          </div>

          <!-- 올플랫 -->
          <div class="band-pill flat-pill" @click="allFlat">
            <q-icon name="horizontal_rule" size="14px" style="color: #78909c" />
            <span class="bp-label">FLAT</span>
          </div>

          <template v-if="channelType === 'input'">
            <q-separator vertical class="q-mx-xs" style="height: 24px" />

            <!-- HPF pill -->
            <div
              class="band-pill"
              :class="{ 'band-pill--sel': hpfSelected, 'band-pill--on': hpf.enabled }"
              style="--bc: #ef5350"
              @click="((hpfSelected = true), (selectedIdx = -1))"
            >
              <span class="bp-dot" />
              <span class="bp-label">HPF</span>
              <q-btn
                flat
                round
                dense
                size="xs"
                :icon="hpf.enabled ? 'radio_button_checked' : 'radio_button_unchecked'"
                :style="`color: #ef5350; opacity: ${hpf.enabled ? 1 : 0.4}`"
                @click.stop="toggleHpf"
              />
            </div>

            <q-separator vertical class="q-mx-xs" style="height: 24px" />
          </template>

          <div
            v-for="(h, i) in handles"
            :key="'bp' + i"
            class="band-pill"
            :class="{ 'band-pill--sel': selectedIdx === i, 'band-pill--on': h.enabled }"
            :style="`--bc: ${h.color}`"
            @click="((selectedIdx = i), (hpfSelected = false))"
          >
            <span class="bp-dot" />
            <span class="bp-label">{{ BAND_LABELS[i] }}</span>
            <q-btn
              flat
              round
              dense
              size="xs"
              :icon="h.enabled ? 'radio_button_checked' : 'radio_button_unchecked'"
              :style="`color: ${h.color}; opacity: ${h.enabled ? 1 : 0.4}`"
              @click.stop="toggleHandle(i)"
            />
          </div>
        </div>

        <!-- HPF controls -->
        <div v-if="hpfSelected && channelType === 'input'" class="band-detail q-mt-sm">
          <div class="row items-center q-mb-sm">
            <span class="detail-title" :style="`color:${HPF_COLOR}`">HPF</span>
            <q-space />
            <q-toggle
              :model-value="hpf.enabled"
              checked-icon="check"
              unchecked-icon="close"
              dense
              div
              color="red-6"
              @update:model-value="toggleHpf"
            />
          </div>
          <div class="row q-gutter-sm">
            <template v-for="def in hpfControlDefs" :key="def.key">
              <!-- Frequency -->
              <div v-if="!def.isButtonGroup" class="col ctrl-col">
                <div class="ctrl-label">{{ def.label }}</div>
                <div class="row items-center q-gutter-x-xs">
                  <q-input
                    v-model.number="hpfFreqModel"
                    outlined
                    type="number"
                    class="row-input"
                    dense
                    :min="def.min"
                    :max="def.max"
                    :step="def.step"
                  />
                  <span class="ctrl-unit">{{ def.unit }}</span>
                </div>
              </div>
              <!-- Slope button group -->
              <div v-else class="col ctrl-col">
                <div class="ctrl-label">{{ def.label }}</div>
                <div class="hpf-slope-group">
                  <button
                    v-for="s in def.options"
                    :key="s"
                    class="hpf-slope-btn"
                    :class="{ 'hpf-slope-btn--on': hpf.slope === s }"
                    @click="((hpf.slope = s), sendHpf())"
                  >
                    {{ s }}
                  </button>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- Selected band controls -->
        <div v-else class="band-detail q-mt-sm">
          <div class="row items-center q-mb-sm">
            <span class="detail-title" :style="`color:${selColor}`">
              {{ BAND_LABELS[selectedIdx] }}
              <span v-if="selBand" class="detail-sub">
                — {{ BAND_TYPE_LABEL_MAP[selBand.type] }}
              </span>
            </span>
            <q-space />
            <!-- 타입 전환 버튼 (모든 밴드에 표시) -->
            <div v-if="selTypeOptions" class="type-toggle q-mr-sm">
              <q-btn
                v-for="t in selTypeOptions"
                :key="t"
                flat
                dense
                no-caps
                size="sm"
                :label="BAND_TYPE_LABEL_MAP[t]"
                :outline="selBand?.type !== t"
                :color="selBand?.type === t ? 'white' : 'grey-7'"
                :class="{ 'type-btn-q--active': selBand?.type === t }"
                :style="
                  selBand?.type === t ? `background-color:${selColor};border-color:${selColor}` : ''
                "
                @click="setType(selBandIdx, t)"
              />
            </div>
            <q-toggle
              :model-value="selEnabled"
              checked-icon="check"
              unchecked-icon="close"
              dense
              color="blue-8"
              @update:model-value="toggleHandle(selectedIdx)"
            />
          </div>

          <div class="row q-gutter-sm">
            <template v-for="def in bandControlDefs" :key="def.key">
              <!-- Freq (always shown) / Gain & Q (conditional on selBand) -->
              <div v-if="def.key === 'freq' || selBand" class="col ctrl-col">
                <div class="ctrl-label">
                  {{ selIsShelf && def.isShelfLabel ? def.isShelfLabel : def.label }}
                </div>
                <div class="row items-center q-gutter-x-xs">
                  <q-input
                    v-if="def.key === 'freq'"
                    v-model.number="bandFreqModel"
                    outlined
                    type="number"
                    class="row-input"
                    dense
                    :min="def.min"
                    :max="def.max"
                    :step="def.step"
                  />
                  <q-input
                    v-else-if="def.key === 'gain'"
                    v-model.number="bandGainModel"
                    outlined
                    type="number"
                    class="row-input"
                    dense
                    :min="def.min"
                    :max="def.max"
                    :step="def.step"
                  />
                  <q-input
                    v-else
                    v-model.number="bandQModel"
                    outlined
                    type="number"
                    class="row-input"
                    dense
                    :min="def.min"
                    :max="def.max"
                    :step="def.step"
                  />
                  <span class="ctrl-unit">{{ def.unit }}</span>
                </div>
              </div>
            </template>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.eq-card {
  min-width: 700px;
  max-width: 780px;
  width: 100%;
}
.bypass-pill {
  border-color: #90caf9 !important;
  gap: 5px;
}
.flat-pill {
  gap: 5px;
}
.flat-pill:hover {
  border-color: #78909c !important;
  background: #eceff1;
}
.bypass-pill--on {
  border-color: #f57c00 !important;
  background: #fff8f0 !important;
}
.bypass-pill--on .bp-label {
  color: #f57c00;
}

.eq-svg {
  display: block;
  border-radius: 4px;
  user-select: none;
}

.band-handle {
  cursor: grab;
}
.band-handle:active {
  cursor: grabbing;
}

/* Band pills */
.band-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 6px 3px 8px;
  border: 1px solid #dde1e7;
  border-radius: 20px;
  cursor: pointer;
  user-select: none;
  transition:
    border-color 0.15s,
    background 0.15s;
  background: #f5f7fa;
}
.band-pill:hover {
  border-color: var(--bc);
}
.band-pill--sel {
  border-color: var(--bc);
  background: #fff;
  box-shadow: 0 0 0 1px var(--bc);
}
.band-pill--on .bp-dot {
  background: var(--bc);
}

.bp-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ccc;
  flex-shrink: 0;
  transition: background 0.15s;
}
.bp-label {
  font-size: 11px;
  font-weight: 600;
  color: #546e7a;
  white-space: nowrap;
}

/* Band detail */
.band-detail {
  background: #f8fafc;
  border: 1px solid #e4e8ed;
  border-radius: 6px;
  padding: 10px 14px;
}
.detail-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.detail-sub {
  font-size: 10px;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: #90a4ae;
}

.type-toggle {
  display: flex;
  gap: 2px;
}

:deep(.type-toggle .q-btn) {
  font-size: 9px !important;
  font-weight: 700 !important;
  padding: 2px 8px !important;
  min-height: auto !important;
  height: auto !important;
}

:deep(.type-toggle .q-btn:not(.type-btn-q--active)) {
  border-color: #cfd8dc !important;
}

:deep(.type-toggle .q-btn:not(.type-btn-q--active):hover) {
  border-color: #90a4ae !important;
  background-color: #eceff1 !important;
}

.ctrl-col {
  min-width: 100px;
}
.ctrl-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: #90a4ae;
  margin-bottom: 2px;
}
.ctrl-range {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: #dce1e7;
  outline: none;
  cursor: pointer;
  margin-bottom: 14px;
}
.ctrl-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--rc, #42a5f5);
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}
.ctrl-range::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--rc, #42a5f5);
  border: none;
  cursor: pointer;
}
.ctrl-num-row {
  display: flex;
  align-items: center;
  gap: 5px;
}
.ctrl-unit {
  font-size: 11px;
  color: #90a4ae;
  white-space: nowrap;
}
.ctrl-num {
  width: 72px;
  font-size: 12px;
  padding: 3px 6px;
  border: 1px solid #cfd8dc;
  border-radius: 3px;
  outline: none;
  background: #fff;
  color: #455a64;
}
.ctrl-num:focus {
  border-color: #90caf9;
  background: #e3f2fd;
}

.hpf-slope-group {
  display: flex;
  gap: 4px;
  margin-top: 6px;
}
.hpf-slope-btn {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border: 1px solid #cfd8dc;
  border-radius: 3px;
  background: #f5f7fa;
  color: #546e7a;
  cursor: pointer;
  transition: all 0.15s;
}
.hpf-slope-btn:hover {
  border-color: #ef5350;
  background: #ffebee;
  color: #ef5350;
}
.hpf-slope-btn--on {
  background: #ef5350;
  border-color: #ef5350;
  color: #fff;
}

/* Dark mode */
.body--dark .eq-card {
  background: #1a1a2e;
}
.body--dark .eq-chname {
  color: #eceff1;
}
.body--dark .band-pill {
  background: #1e2030;
  border-color: #2a3444;
}
.body--dark .band-pill--sel {
  background: #1a1a2e;
}
.body--dark .bp-label {
  color: #90a4ae;
}
.body--dark .band-detail {
  background: #161622;
  border-color: #2a3444;
}
.body--dark .ctrl-num {
  background: #1e2030;
  border-color: #37474f;
  color: #eceff1;
}
.body--dark .ctrl-num:focus {
  border-color: #1565c0;
  background: #0d1b2e;
}

.row-input {
  width: 72px;
  font-size: 12px;
}

:deep(.row-input .q-field__control) {
  min-height: 28px !important;
  height: 28px;
}
:deep(.row-input .q-field__native) {
  padding: 0;
  min-height: 28px;
}
:deep(.row-input .q-field__append) {
  height: 20px;
  align-self: center;
}
:deep(.row-input input[type='number']::-webkit-inner-spin-button) {
  transform: scale(0.7);
  transform-origin: center;
}
</style>
