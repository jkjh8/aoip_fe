<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { socket } from 'src/boot/socket'
import { useAoipStore } from 'src/stores/aoip'
import 'src/css/dsp-dynamics.css'

const aoipStore = useAoipStore()

const props = defineProps({
  channel: Object,
  channelRight: Object,
  channelType: { type: String, default: 'input' },
  grDb: { type: Number, default: 0 },
})

const W = 260,
  H = 200,
  ML = 26,
  MT = 8,
  MR = 6,
  MB = 22
const PW = W - ML - MR,
  PH = H - MT - MB
const GRID = [-60, -40, -20, 0]
const DEFAULTS = { threshold: -40, attackMs: 5, holdMs: 5, releaseMs: 100, rangeDb: -60 }

const enabled = ref(false)
const gate = reactive({ ...DEFAULTS })

const PARAMS = [
  { key: 'threshold', label: 'Threshold', min: -60, max: 0, step: 1, unit: 'dB' },
  { key: 'attackMs', label: 'Attack', min: 0.1, max: 500, step: 0.1, unit: 'ms' },
  { key: 'holdMs', label: 'Hold', min: 0, max: 2000, step: 1, unit: 'ms' },
  { key: 'releaseMs', label: 'Release', min: 1, max: 5000, step: 10, unit: 'ms' },
  { key: 'rangeDb', label: 'Range', min: -60, max: 0, step: 1, unit: 'dB' },
]

function xOf(db) {
  return ML + ((db + 60) / 60) * PW
}
function yOf(db) {
  return MT + ((0 - db) / 60) * PH
}

const refPath = `M ${xOf(-60).toFixed(1)} ${yOf(-60).toFixed(1)} L ${xOf(0).toFixed(1)} ${yOf(0).toFixed(1)}`
const grVal = computed(() => Math.max(0, Math.min(60, props.grDb)))
const grPct = computed(() => (enabled.value ? (grVal.value / 60) * 100 : 0))
function fmtGr(v) {
  return v < 0.1 ? '0.0' : '-' + v.toFixed(1)
}

const curvePath = computed(() => {
  const t = Math.max(-60, Math.min(0, gate.threshold))
  const r = Math.max(-60, Math.min(0, gate.rangeDb))
  const cl = (v) => Math.max(-60, Math.min(0, v))
  return [
    [xOf(-60), yOf(cl(-60 + r))],
    [xOf(t), yOf(cl(t + r))],
    [xOf(t), yOf(t)],
    [xOf(0), yOf(0)],
  ]
    .map((p, i) => `${i ? 'L' : 'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(' ')
})

const thrX = computed(() => xOf(Math.max(-60, Math.min(0, gate.threshold))))
const rngX = computed(() => xOf(Math.max(-60, Math.min(0, gate.threshold))))
const rngY = computed(() => yOf(Math.max(-60, Math.min(0, gate.threshold + gate.rangeDb))))

let svgEl = null
const setSvgRef = (el) => {
  svgEl = el
}
function svgPt(e) {
  if (!svgEl) return { x: 0, y: 0 }
  const r = svgEl.getBoundingClientRect()
  return {
    x: ((e.touches?.[0]?.clientX ?? e.clientX) - r.left) * (W / r.width),
    y: ((e.touches?.[0]?.clientY ?? e.clientY) - r.top) * (H / r.height),
  }
}

let _debTimer = null
function debounceSend() {
  clearTimeout(_debTimer)
  _debTimer = setTimeout(send, 300)
}

function onThrDown(e) {
  e.preventDefault()
  _editing = true
  const move = (me) => {
    gate.threshold = Math.round(Math.max(-60, Math.min(0, ((svgPt(me).x - ML) / PW) * 60 - 60)))
    debounceSend()
  }
  const up = () => {
    clearTimeout(_debTimer)
    _editing = false
    send()
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}
function onRngDown(e) {
  e.preventDefault()
  _editing = true
  const move = (me) => {
    const db = (-(svgPt(me).y - MT) / PH) * 60
    gate.rangeDb = Math.round(Math.max(-60, Math.min(0, db - gate.threshold)))
    debounceSend()
  }
  const up = () => {
    clearTimeout(_debTimer)
    _editing = false
    send()
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

let _editing = false
let _skipNextBlur = false

function send() {
  if (!props.channel) return
  const ids = [props.channel.id, props.channelRight?.id].filter(Boolean)
  const list =
    props.channelType === 'input' ? aoipStore.channels.inputs : aoipStore.channels.outputs
  for (const id of ids) {
    socket.emit('dsp:gate', {
      type: props.channelType,
      id,
      params: { enabled: enabled.value, ...gate },
    })
    const ch = list.find((c) => c.id === id)
    if (ch) {
      if (!ch.dsp) ch.dsp = {}
      ch.dsp.gate = { enabled: enabled.value, ...gate }
    }
  }
}

function toggle() {
  enabled.value = !enabled.value
  send()
}

function clampSend(key) {
  const d = PARAMS.find((d) => d.key === key)
  if (!d) return
  const n = Number(gate[key])
  gate[key] = Math.max(d.min, Math.min(d.max, isFinite(n) ? n : d.min))
  send()
}

function init(dsp) {
  const g = dsp?.gate
  if (g === undefined) return
  enabled.value = g.enabled ?? false
  Object.assign(gate, {
    threshold: g.threshold ?? DEFAULTS.threshold,
    attackMs: g.attackMs ?? DEFAULTS.attackMs,
    holdMs: g.holdMs ?? DEFAULTS.holdMs,
    releaseMs: g.releaseMs ?? DEFAULTS.releaseMs,
    rangeDb: g.rangeDb ?? DEFAULTS.rangeDb,
  })
}

watch(
  () => props.channel?.dsp,
  (dsp) => {
    if (dsp && !_editing) init(dsp)
  },
  { deep: true, immediate: true },
)

defineExpose({ enabled })
</script>

<template>
  <div class="dyn-tab">
    <div class="dyn-graph">
      <div class="gr-row">
        <span class="gr-lbl">GR</span>
        <div class="gr-bar-track"><div class="gr-bar-fill" :style="`width:${grPct}%`" /></div>
        <span class="gr-val">{{ fmtGr(grVal) }} dB</span>
      </div>
      <div class="graph-lbl">Transfer Curve</div>
      <svg :ref="setSvgRef" :viewBox="`0 0 ${W} ${H}`" width="100%" class="dyn-svg">
        <rect x="0" y="0" :width="W" :height="H" fill="#181b22" />
        <line
          v-for="db in GRID"
          :key="'gx' + db"
          :x1="xOf(db)"
          :y1="MT"
          :x2="xOf(db)"
          :y2="MT + PH"
          :stroke="db === 0 ? '#374055' : '#252a36'"
          :stroke-width="db === 0 ? 1 : 0.6"
        />
        <line
          v-for="db in GRID"
          :key="'gy' + db"
          :x1="ML"
          :y1="yOf(db)"
          :x2="ML + PW"
          :y2="yOf(db)"
          :stroke="db === 0 ? '#374055' : '#252a36'"
          :stroke-width="db === 0 ? 1 : 0.6"
        />
        <path :d="refPath" fill="none" stroke="#2e3448" stroke-width="0.9" stroke-dasharray="3,3" />
        <path
          :d="curvePath"
          fill="none"
          stroke="#43a047"
          stroke-width="2"
          stroke-linejoin="round"
        />
        <text
          v-for="db in GRID"
          :key="'tlx' + db"
          :x="xOf(db)"
          :y="MT + PH + 14"
          text-anchor="middle"
          font-size="7.5"
          fill="#4a5574"
          font-family="monospace"
        >
          {{ db }}
        </text>
        <text
          v-for="db in GRID"
          :key="'tly' + db"
          :x="ML - 3"
          :y="yOf(db) + 2.5"
          text-anchor="end"
          font-size="7.5"
          fill="#4a5574"
          font-family="monospace"
        >
          {{ db }}
        </text>
        <!-- Threshold handle -->
        <g class="drag-ew" @pointerdown.prevent="onThrDown">
          <line
            :x1="thrX"
            :y1="MT"
            :x2="thrX"
            :y2="MT + PH"
            stroke="#43a047"
            stroke-width="6"
            opacity="0"
          />
          <line
            :x1="thrX"
            :y1="MT"
            :x2="thrX"
            :y2="MT + PH"
            stroke="#43a047"
            stroke-width="1.2"
            stroke-dasharray="4,3"
            opacity="0.6"
          />
          <circle
            :cx="thrX"
            :cy="MT + PH * 0.5"
            r="6"
            fill="#43a047"
            fill-opacity="0.2"
            stroke="#43a047"
            stroke-width="1.4"
          />
          <text
            :x="thrX + 5"
            :y="MT + 10"
            font-size="7"
            fill="#43a047"
            fill-opacity="0.85"
            font-family="monospace"
          >
            {{ gate.threshold }}dB
          </text>
        </g>
        <!-- Range handle -->
        <g class="drag-ns" @pointerdown.prevent="onRngDown">
          <circle
            :cx="rngX"
            :cy="rngY"
            r="7"
            fill="#43a047"
            fill-opacity="0"
            stroke="transparent"
            stroke-width="12"
          />
          <circle
            :cx="rngX"
            :cy="rngY"
            r="6"
            fill="#43a047"
            fill-opacity="0.12"
            stroke="#43a047"
            stroke-width="1.4"
            opacity="0.75"
          />
          <text
            :x="rngX + 8"
            :y="rngY + 3.5"
            font-size="6.5"
            fill="#43a047"
            fill-opacity="0.75"
            font-family="monospace"
          >
            {{ gate.rangeDb }}dB
          </text>
        </g>
      </svg>
    </div>
    <div class="dyn-params">
      <div class="ctrl-hdr">
        <q-toggle
          :model-value="enabled"
          dense
          size="md"
          color="green-7"
          @update:model-value="toggle"
        />
        <span class="ctrl-name" style="color: #43a047">GATE</span>
        <span class="onoff" :class="enabled ? 'onoff--on' : 'onoff--off'">{{
          enabled ? 'ON' : 'OFF'
        }}</span>
      </div>
      <div class="param-list">
        <div v-for="d in PARAMS" :key="d.key" class="param-row">
          <span class="param-lbl">{{ d.label }}</span>
          <q-input
            v-model.number="gate[d.key]"
            type="number"
            dense
            outlined
            :suffix="d.unit"
            class="dsp-num-inp"
            @focus="_editing = true"
            @blur="((_editing = false), _skipNextBlur ? (_skipNextBlur = false) : clampSend(d.key))"
            @keydown.enter.prevent="((_skipNextBlur = true), clampSend(d.key))"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gr-bar-fill { background: linear-gradient(to left, #43a047, #2e7d32); }
.gr-val { font-size: 16px; color: #43a047; }
.onoff--on { color: #43a047; }
</style>
