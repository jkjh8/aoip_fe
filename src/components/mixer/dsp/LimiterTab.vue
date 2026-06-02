<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { socket } from 'src/boot/socket'
import { useAoipStore } from 'src/stores/aoip'
import 'src/css/dsp-dynamics.css'

const aoipStore = useAoipStore()

const props = defineProps({
  channel: Object,
  channelRight: Object,
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
const DEFAULTS = { threshold: -0.5, releaseMs: 100 }

const enabled = ref(false)
const lim = reactive({ ...DEFAULTS })

const PARAMS = [
  { key: 'threshold', label: 'Threshold', min: -60, max: 0, step: 0.5, unit: 'dBFS' },
  { key: 'releaseMs', label: 'Release', min: 1, max: 5000, step: 10, unit: 'ms' },
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
  const t = Math.max(-60, Math.min(0, lim.threshold))
  return [
    [xOf(-60), yOf(-60)],
    [xOf(t), yOf(t)],
    [xOf(0), yOf(t)],
  ]
    .map((p, i) => `${i ? 'L' : 'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(' ')
})

const thrY = computed(() => yOf(Math.max(-60, Math.min(0, lim.threshold))))

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
    lim.threshold = Math.round(Math.max(-60, Math.min(0, (-(svgPt(me).y - MT) / PH) * 60)) * 2) / 2
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
  for (const id of ids) {
    socket.emit('dsp:lim', { id, params: { enabled: enabled.value, ...lim } })
    const ch = aoipStore.channels.outputs.find((c) => c.id === id)
    if (ch) {
      if (!ch.dsp) ch.dsp = {}
      ch.dsp.lim = { enabled: enabled.value, ...lim }
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
  const n = Number(lim[key])
  lim[key] = Math.max(d.min, Math.min(d.max, isFinite(n) ? n : d.min))
  send()
}

function init(dsp) {
  const l = dsp?.lim ?? dsp?.limiter
  if (l === undefined) return
  enabled.value = l?.enabled ?? false
  Object.assign(lim, {
    threshold: l?.threshold ?? DEFAULTS.threshold,
    releaseMs: l?.releaseMs ?? l?.release ?? DEFAULTS.releaseMs,
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
      <div class="graph-lbl">Brick Wall Curve</div>
      <svg :ref="setSvgRef" :viewBox="`0 0 ${W} ${H}`" width="100%" class="dyn-svg">
        <rect x="0" y="0" :width="W" :height="H" fill="#181b22" />
        <line
          v-for="db in GRID"
          :key="'lx' + db"
          :x1="xOf(db)"
          :y1="MT"
          :x2="xOf(db)"
          :y2="MT + PH"
          :stroke="db === 0 ? '#374055' : '#252a36'"
          :stroke-width="db === 0 ? 1 : 0.6"
        />
        <line
          v-for="db in GRID"
          :key="'ly' + db"
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
          stroke="#c62828"
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
        <!-- Threshold handle (drag vertically) -->
        <g class="drag-ns" @pointerdown.prevent="onThrDown">
          <line
            :x1="ML"
            :y1="thrY"
            :x2="ML + PW"
            :y2="thrY"
            stroke="#c62828"
            stroke-width="7"
            opacity="0"
          />
          <line
            :x1="ML"
            :y1="thrY"
            :x2="ML + PW"
            :y2="thrY"
            stroke="#c62828"
            stroke-width="1.2"
            stroke-dasharray="4,3"
            opacity="0.5"
          />
          <circle
            :cx="ML + PW / 2"
            :cy="thrY"
            r="6"
            fill="#c62828"
            fill-opacity="0.15"
            stroke="#c62828"
            stroke-width="1.4"
          />
          <text
            :x="ML + PW / 2 + 8"
            :y="thrY - 4"
            font-size="7"
            fill="#c62828"
            fill-opacity="0.85"
            font-family="monospace"
          >
            {{ lim.threshold }}dBFS
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
          color="red-8"
          @update:model-value="toggle"
        />
        <span class="ctrl-name" style="color: #c62828">LIMITER</span>
        <span class="onoff" :class="enabled ? 'onoff--lim' : 'onoff--off'">{{
          enabled ? 'ON' : 'OFF'
        }}</span>
      </div>
      <div class="param-list">
        <div v-for="d in PARAMS" :key="d.key" class="param-row">
          <span class="param-lbl">{{ d.label }}</span>
          <q-input
            v-model.number="lim[d.key]"
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
.gr-row { padding: 0; }
.gr-lbl { font-size: 10px; }
.gr-bar-fill { background: linear-gradient(to left, #c62828, #b71c1c); }
.gr-val { font-size: 11px; color: #c62828; }
.onoff--lim { color: #c62828; }
</style>
