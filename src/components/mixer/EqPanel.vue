<script setup>
import { ref, computed, watch } from 'vue'
import { socket } from 'src/boot/socket'

const props = defineProps({
  modelValue: Boolean,
  channel: Object, // 기준 채널 (mono 또는 stereo left)
  channelRight: Object, // 스테레오 right 채널 (없으면 null)
  channelType: String, // 'input' | 'output'
})
const emit = defineEmits(['update:modelValue'])

// ── Constants ──────────────────────────────────────────────
const FS = 48000

const COLORS = ['#ffa726', '#66bb6a', '#42a5f5', '#ab47bc']
const BAND_LABELS = ['Band 1', 'Band 2', 'Band 3', 'Band 4']

const HPF_COLOR  = '#ef5350'
const HPF_SLOPES = [12, 24, 48, 96]

const DEFAULT_BANDS = [
  { enabled: false, freq: 100, gain: 0, q: 0.7, type: 'peak' }, // ← low_shelf 전환 가능
  { enabled: false, freq: 500, gain: 0, q: 0.7, type: 'peak' },
  { enabled: false, freq: 2000, gain: 0, q: 0.7, type: 'peak' },
  { enabled: false, freq: 8000, gain: 0, q: 0.7, type: 'peak' }, // ← high_shelf 전환 가능
]
// 밴드 인덱스별 전환 가능 타입 목록 (없으면 peak 고정)
const BAND_TYPE_OPTIONS = {
  0: ['peak', 'low_shelf'],
  3: ['peak', 'high_shelf'],
}

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
      if (bands.value[i])
        Object.assign(bands.value[i], {
          enabled: src.enabled,
          freq: src.freq,
          gain: src.gain,
          q: src.q,
          type: src.bandType ?? src.type ?? 'peak',
        })
    })
  } else {
    bands.value = DEFAULT_BANDS.map((b) => ({ ...b }))
  }
  if (dsp?.hpf) {
    hpf.value = {
      enabled: dsp.hpf.enabled ?? false,
      freq:    dsp.hpf.freq   ?? 80,
      slope:   dsp.hpf.slope  ?? 12,
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
watch(() => props.channel?.dsp, () => { if (!isDragging) initFromChannel() }, { deep: true })

// ── SVG layout ─────────────────────────────────────────────
const PL = 34,
  PR = 8,
  PT = 12,
  PB = 30
const SVG_W = 700,
  SVG_H = 320
const PW = SVG_W - PL - PR
const PH = SVG_H - PT - PB

const FREQ_MIN = 20,
  FREQ_MAX = 20000
const GAIN_MIN = -15,
  GAIN_MAX = 15

function freqToX(f) {
  return (Math.log10(Math.max(FREQ_MIN, f) / FREQ_MIN) / Math.log10(FREQ_MAX / FREQ_MIN)) * PW
}
function gainToY(g) {
  return (1 - (g - GAIN_MIN) / (GAIN_MAX - GAIN_MIN)) * PH
}
function xToFreq(x) {
  return (
    FREQ_MIN * Math.pow(10, (Math.max(0, Math.min(PW, x)) / PW) * Math.log10(FREQ_MAX / FREQ_MIN))
  )
}
function yToGain(y) {
  return GAIN_MAX - (Math.max(0, Math.min(PH, y)) / PH) * (GAIN_MAX - GAIN_MIN)
}

// ── Biquad ─────────────────────────────────────────────────
function shelfCoeffs(type, freq, gainDb, q) {
  const A = Math.pow(10, gainDb / 40)
  const w0 = (2 * Math.PI * Math.min(freq, FS * 0.499)) / FS
  const cosW = Math.cos(w0),
    sinW = Math.sin(w0)
  const sqA = Math.sqrt(Math.max(0, A))
  const S = Math.max(0.1, q)
  const al = (sinW / 2) * Math.sqrt(Math.max(0, (A + 1 / A) * (1 / S - 1) + 2))
  let b0, b1, b2, a0, a1, a2
  if (type === 'low_shelf') {
    b0 = A * (A + 1 - (A - 1) * cosW + 2 * sqA * al)
    b1 = 2 * A * (A - 1 - (A + 1) * cosW)
    b2 = A * (A + 1 - (A - 1) * cosW - 2 * sqA * al)
    a0 = A + 1 + (A - 1) * cosW + 2 * sqA * al
    a1 = -2 * (A - 1 + (A + 1) * cosW)
    a2 = A + 1 + (A - 1) * cosW - 2 * sqA * al
  } else {
    b0 = A * (A + 1 + (A - 1) * cosW + 2 * sqA * al)
    b1 = -2 * A * (A - 1 + (A + 1) * cosW)
    b2 = A * (A + 1 + (A - 1) * cosW - 2 * sqA * al)
    a0 = A + 1 - (A - 1) * cosW + 2 * sqA * al
    a1 = 2 * (A - 1 - (A + 1) * cosW)
    a2 = A + 1 - (A - 1) * cosW - 2 * sqA * al
  }
  if (Math.abs(a0) < 1e-10) return null
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 }
}

function peakCoeffs(freq, gainDb, q) {
  const A = Math.pow(10, gainDb / 40)
  const w0 = (2 * Math.PI * Math.min(freq, FS * 0.499)) / FS
  const cosW = Math.cos(w0),
    sinW = Math.sin(w0)
  const alpha = sinW / (2 * Math.max(0.01, q))
  const b0 = 1 + alpha * A,
    b1 = -2 * cosW,
    b2 = 1 - alpha * A
  const a0 = 1 + alpha / A,
    a1 = -2 * cosW,
    a2 = 1 - alpha / A
  if (Math.abs(a0) < 1e-10) return null
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 }
}

function magSq(c, f) {
  const w = (2 * Math.PI * f) / FS
  const cw = Math.cos(w),
    c2w = Math.cos(2 * w)
  const n =
    c.b0 * c.b0 +
    c.b1 * c.b1 +
    c.b2 * c.b2 +
    2 * (c.b0 * c.b1 + c.b1 * c.b2) * cw +
    2 * c.b0 * c.b2 * c2w
  const d = 1 + c.a1 * c.a1 + c.a2 * c.a2 + 2 * (c.a1 + c.a1 * c.a2) * cw + 2 * c.a2 * c2w
  return d > 0 ? Math.max(0, n / d) : 1
}

function bandCoeffs(b) {
  if (b.type === 'low_shelf' || b.type === 'high_shelf')
    return shelfCoeffs(b.type, b.freq, b.gain, b.q)
  return peakCoeffs(b.freq, b.gain, b.q)
}

// ── HPF biquad (Butterworth) ───────────────────────────────
function hpfBiquad(freq) {
  const Q  = 1 / Math.sqrt(2)
  const w0 = (2 * Math.PI * Math.min(freq, FS * 0.499)) / FS
  const cosW = Math.cos(w0), sinW = Math.sin(w0)
  const alpha = sinW / (2 * Q)
  const b0 = (1 + cosW) / 2, b1 = -(1 + cosW), b2 = (1 + cosW) / 2
  const a0 = 1 + alpha,      a1 = -2 * cosW,    a2 = 1 - alpha
  return { b0: b0/a0, b1: b1/a0, b2: b2/a0, a1: a1/a0, a2: a2/a0 }
}

function hpfCoeffsList() {
  if (!hpf.value.enabled) return []
  const n = (hpf.value.slope ?? 12) / 12
  const c = hpfBiquad(hpf.value.freq)
  return Array(n).fill(c)
}

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
    hpfThrottleTimer = setTimeout(() => {
      hpfLastSend = Date.now()
      sendHpf()
    }, THROTTLE_MS - (now - hpfLastSend))
  }
}

function sendHpf() {
  if (!props.channel) return
  const ids = [props.channel?.id, props.channelRight?.id].filter(Boolean)
  for (const id of ids) {
    socket.emit('dsp:hpf', {
      id,
      type:    props.channelType,
      enabled: hpf.value.enabled,
      freq:    hpf.value.freq,
      slope:   hpf.value.slope,
    })
  }
}

function toggleHpf() {
  hpf.value.enabled = !hpf.value.enabled
  sendHpf()
}

function onHpfPointerdown(e) {
  e.preventDefault()
  hpfSelected.value = true

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
    if (moved) { clearTimeout(hpfThrottleTimer); sendHpf() }
    dragCooldownTimer = setTimeout(() => { isDragging = false }, DRAG_COOLDOWN_MS)
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

// ── Frequency response ─────────────────────────────────────
const NUM_PTS = 280

const curvePts = computed(() => {
  const pts = []
  // bypass ON 이면 필터 없음 → 0dB 플랫 커브
  const coeffsList = []
  if (!bypass.value) {
    for (const c of hpfCoeffsList()) coeffsList.push(c)
    for (const b of bands.value) {
      if (!b.enabled) continue
      const c = bandCoeffs(b)
      if (c) coeffsList.push(c)
    }
  }

  for (let i = 0; i <= NUM_PTS; i++) {
    const f = FREQ_MIN * Math.pow(FREQ_MAX / FREQ_MIN, i / NUM_PTS)
    let ms = 1
    for (const c of coeffsList) ms *= magSq(c, f)
    const db = 10 * Math.log10(Math.max(1e-12, ms))
    pts.push({ x: freqToX(f), y: gainToY(Math.max(GAIN_MIN, Math.min(GAIN_MAX, db))) })
  }
  return pts
})

const curvePath = computed(() => {
  const pts = curvePts.value
  return pts.length ? 'M ' + pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ') : ''
})

const areaPath = computed(() => {
  const pts = curvePts.value
  if (!pts.length) return ''
  const zY = gainToY(0).toFixed(1)
  const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')
  return `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} L ${line} L ${pts[pts.length - 1].x.toFixed(1)},${zY} L ${pts[0].x.toFixed(1)},${zY} Z`
})

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
  20,30,40,50,60,70,80,90,
  200,300,400,500,600,700,800,900,
  2000,3000,4000,5000,6000,7000,8000,9000,
  20000,
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

  // 드래그 시작 시 해당 밴드 자동 ON
  let autoEnabled = false
  if (!bands.value[i].enabled) {
    bands.value[i].enabled = true
    autoEnabled = true
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
    dragCooldownTimer = setTimeout(() => { isDragging = false }, DRAG_COOLDOWN_MS)
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
    socket.emit('dsp:eq', { ...payload, id })
  }
}

function sendBand(bandIdx) {
  if (!props.channel) return
  const b = bands.value[bandIdx]
  const coeffs = bandCoeffs(b)
  emitEq({
    type: props.channelType,
    band: bandIdx,
    enabled: b.enabled,
    freq: b.freq,
    gain: b.gain,
    q: b.q,
    bandType: b.type,
    ...(coeffs ?? {}),
  })
}

function toggleBypass() {
  if (!bypass.value) {
    // 바이패스 ON: 현재 enabled 상태 저장 후 전체 비활성화
    savedEnabled = { bands: bands.value.map((b) => b.enabled), hpf: hpf.value.enabled }
    bypass.value = true
    bands.value.forEach((b, idx) => { b.enabled = false; sendBand(idx) })
    hpf.value.enabled = false; sendHpf()
  } else {
    // 바이패스 OFF: 저장된 상태 복원 + 전체 계수 재전송
    bypass.value = false
    if (savedEnabled) {
      bands.value.forEach((b, idx) => { b.enabled = savedEnabled.bands[idx]; sendBand(idx) })
      hpf.value.enabled = savedEnabled.hpf; sendHpf()
      savedEnabled = null
    }
  }
}

function disableHandle(i) {
  bands.value[i].enabled = false
  sendBand(i)
}

function allFlat() {
  bands.value.forEach((b, idx) => {
    b.gain = 0
    sendBand(idx)
  })
}

function toggleHandle(i) {
  bands.value[i].enabled = !bands.value[i].enabled
  sendBand(i)
}

// ── Type cycling for convertible bands ────────────────────
function cycleType(bandIdx) {
  const options = BAND_TYPE_OPTIONS[bandIdx]
  if (!options) return
  const b = bands.value[bandIdx]
  const next = options[(options.indexOf(b.type) + 1) % options.length]
  b.type = next
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
const selTypeOptions = computed(() => BAND_TYPE_OPTIONS[selBandIdx.value] ?? null)

const BAND_TYPE_LABEL_MAP = {
  peak: 'Peak',
  low_shelf: 'Low Shelf',
  high_shelf: 'Hi Shelf',
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

</script>

<template>
  <q-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <q-card class="eq-card">
      <!-- Header -->
      <q-card-section class="row items-center no-wrap q-py-sm q-px-md">
        <q-icon name="equalizer" size="18px" color="blue-grey-5" class="q-mr-xs" />
        <span class="eq-title">EQ</span>
        <span class="eq-chname">{{ channelRight ? channel?.label?.replace(/\s*(CH\d+|[LR]|\d+)$/i, '').trim() : channel?.label }}</span>
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
              stroke="#1e1e2e"
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
                v-if="hpf.enabled || hpfSelected"
                class="band-handle"
                @pointerdown="onHpfPointerdown"
              >
                <line
                  :x1="freqToX(hpf.freq)" y1="0"
                  :x2="freqToX(hpf.freq)" :y2="PH"
                  :stroke="HPF_COLOR" stroke-width="1.5"
                  stroke-dasharray="4,2" opacity="0.65"
                />
                <circle
                  :cx="freqToX(hpf.freq)" :cy="PH * 0.5"
                  r="9"
                  :fill="HPF_COLOR" :fill-opacity="hpf.enabled ? 0.22 : 0.06"
                  :stroke="HPF_COLOR" :stroke-width="hpfSelected ? 2.5 : 1.5"
                  :stroke-opacity="hpf.enabled ? 1 : 0.35"
                />
                <circle :cx="freqToX(hpf.freq)" :cy="PH * 0.5" r="3.5" :fill="HPF_COLOR" :fill-opacity="hpf.enabled ? 1 : 0.2" />
                <text
                  :x="freqToX(hpf.freq)" :y="PH * 0.5 - 14"
                  text-anchor="middle" font-size="8" font-weight="700"
                  :fill="HPF_COLOR" :fill-opacity="hpf.enabled ? 1 : 0.5"
                  font-family="sans-serif"
                >HPF</text>
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
            <q-icon name="horizontal_rule" size="14px" style="color:#78909c" />
            <span class="bp-label">FLAT</span>
          </div>

          <q-separator vertical class="q-mx-xs" style="height: 24px" />

          <!-- HPF pill -->
          <div
            class="band-pill"
            :class="{ 'band-pill--sel': hpfSelected, 'band-pill--on': hpf.enabled }"
            style="--bc: #ef5350"
            @click="hpfSelected = true; selectedIdx = -1"
          >
            <span class="bp-dot" />
            <span class="bp-label">HPF</span>
            <q-btn
              flat round dense size="xs"
              :icon="hpf.enabled ? 'radio_button_checked' : 'radio_button_unchecked'"
              :style="`color: #ef5350; opacity: ${hpf.enabled ? 1 : 0.4}`"
              @click.stop="toggleHpf"
            />
          </div>

          <q-separator vertical class="q-mx-xs" style="height: 24px" />

          <div
            v-for="(h, i) in handles"
            :key="'bp' + i"
            class="band-pill"
            :class="{ 'band-pill--sel': selectedIdx === i, 'band-pill--on': h.enabled }"
            :style="`--bc: ${h.color}`"
            @click="selectedIdx = i; hpfSelected = false"
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
        <div v-if="hpfSelected" class="band-detail q-mt-sm">
          <div class="row items-center q-mb-sm">
            <span class="detail-title" :style="`color:${HPF_COLOR}`">HPF</span>
            <q-space />
            <q-toggle
              :model-value="hpf.enabled"
              checked-icon="check" unchecked-icon="close"
              dense color="red-6"
              @update:model-value="toggleHpf"
            />
          </div>
          <div class="row q-gutter-sm">
            <!-- Freq -->
            <div class="col ctrl-col">
              <div class="ctrl-label">Frequency</div>
              <input
                type="range" class="ctrl-range"
                :value="freqToX(hpf.freq)" :min="0" :max="PW" step="1"
                :style="`--rc:${HPF_COLOR}`"
                @input="setHpfFreq(xToFreq(Number($event.target.value)))"
              />
              <div class="ctrl-num-row">
                <input
                  type="number" class="ctrl-num"
                  :value="hpf.freq" min="20" max="2000" step="1"
                  @change="setHpfFreq($event.target.value)"
                />
                <span class="ctrl-unit">Hz</span>
              </div>
            </div>
            <!-- Slope -->
            <div class="col ctrl-col">
              <div class="ctrl-label">Slope</div>
              <div class="hpf-slope-group">
                <button
                  v-for="s in HPF_SLOPES" :key="s"
                  class="hpf-slope-btn"
                  :class="{ 'hpf-slope-btn--on': hpf.slope === s }"
                  @click="hpf.slope = s; sendHpf()"
                >{{ s }}</button>
              </div>
            </div>
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
            <!-- 타입 전환 버튼 (Band 1, Band 4만 표시) -->
            <div v-if="selTypeOptions" class="type-toggle q-mr-sm">
              <button
                v-for="t in selTypeOptions"
                :key="t"
                class="type-btn"
                :class="{ 'type-btn--active': selBand?.type === t }"
                :style="
                  selBand?.type === t ? `background:${selColor};border-color:${selColor}` : ''
                "
                @click="cycleType(selBandIdx)"
              >
                {{ BAND_TYPE_LABEL_MAP[t] }}
              </button>
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
            <!-- Freq (always shown) -->
            <div class="col ctrl-col">
              <div class="ctrl-label">Frequency</div>
              <input
                type="range"
                class="ctrl-range"
                :value="freqToX(selBand?.freq ?? 100)"
                :min="0"
                :max="PW"
                step="1"
                :style="`--rc:${selColor}`"
                @input="setFreq(xToFreq(Number($event.target.value)))"
              />
              <div class="ctrl-num-row">
                <input
                  type="number"
                  class="ctrl-num"
                  :value="selBand?.freq"
                  min="20"
                  max="20000"
                  step="1"
                  @change="setFreq($event.target.value)"
                />
                <span class="ctrl-unit">Hz</span>
              </div>
            </div>

            <!-- Gain -->
            <div v-if="selBand" class="col ctrl-col">
              <div class="ctrl-label">Gain</div>
              <input
                type="range"
                class="ctrl-range"
                :value="selBand?.gain ?? 0"
                min="-15"
                max="15"
                step="0.5"
                :style="`--rc:${selColor}`"
                @input="setGain($event.target.value)"
              />
              <div class="ctrl-num-row">
                <input
                  type="number"
                  class="ctrl-num"
                  :value="selBand?.gain ?? 0"
                  min="-15"
                  max="15"
                  step="0.5"
                  @change="setGain($event.target.value)"
                />
                <span class="ctrl-unit">dB</span>
              </div>
            </div>

            <!-- Q / Slope -->
            <div v-if="selBand" class="col ctrl-col">
              <div class="ctrl-label">{{ selIsShelf ? 'Slope' : 'Q' }}</div>
              <input
                type="range"
                class="ctrl-range"
                :value="selBand?.q ?? 1"
                min="0.1"
                max="10"
                step="0.05"
                :style="`--rc:${selColor}`"
                @input="setQ($event.target.value)"
              />
              <input
                type="number"
                class="ctrl-num"
                :value="selBand?.q ?? 1"
                min="0.1"
                max="10"
                step="0.05"
                @change="setQ($event.target.value)"
              />
            </div>
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

.eq-title {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: #607d8b;
  margin-right: 6px;
}
.eq-chname {
  font-size: 14px;
  font-weight: 600;
  color: #37474f;
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
.type-btn {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 8px;
  border: 1px solid #cfd8dc;
  border-radius: 3px;
  background: #f5f7fa;
  color: #78909c;
  cursor: pointer;
  transition: all 0.15s;
}
.type-btn:hover {
  border-color: #90a4ae;
  background: #eceff1;
}
.type-btn--active {
  color: #fff !important;
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
.hpf-slope-btn:hover { border-color: #ef5350; background: #ffebee; color: #ef5350; }
.hpf-slope-btn--on   { background: #ef5350; border-color: #ef5350; color: #fff; }

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

.slope-btn {
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid #cfd8dc;
  border-radius: 4px;
  background: #f5f5f5;
  cursor: pointer;
  color: #546e7a;
  line-height: 22px;
}
.slope-btn:hover {
  background: #eceff1;
  border-color: #90a4ae;
}
.slope-btn--active {
  background: #1565c0;
  border-color: #1565c0;
  color: #fff;
}
</style>
