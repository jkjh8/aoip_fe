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
const DEFAULTS = { threshold: -20, ratio: 4, knee: 6, attackMs: 10, releaseMs: 200, makeupDb: 0 }

const enabled = ref(false)
const comp = reactive({ ...DEFAULTS })

const PARAMS = [
  { key: 'threshold', label: 'Threshold', min: -60, max: 0, step: 0.5, unit: 'dB' },
  { key: 'ratio', label: 'Ratio', min: 1, max: 20, step: 0.1, unit: ':1' },
  { key: 'knee', label: 'Knee', min: 0, max: 24, step: 0.5, unit: 'dB' },
  { key: 'attackMs', label: 'Attack', min: 0.1, max: 500, step: 0.1, unit: 'ms' },
  { key: 'releaseMs', label: 'Release', min: 1, max: 5000, step: 10, unit: 'ms' },
  { key: 'makeupDb', label: 'Makeup', min: 0, max: 40, step: 0.5, unit: 'dB' },
]

const grVal = computed(() => Math.max(0, Math.min(30, props.grDb)))
const grPct = computed(() => (enabled.value ? (grVal.value / 30) * 100 : 0))
function fmtGr(v) {
  return v < 0.1 ? '0.0' : '-' + v.toFixed(1)
}

function xOf(db) {
  return ML + ((db + 60) / 60) * PW
}
function yOf(db) {
  return MT + ((0 - db) / 60) * PH
}

const refPath = `M ${xOf(-60).toFixed(1)} ${yOf(-60).toFixed(1)} L ${xOf(0).toFixed(1)} ${yOf(0).toFixed(1)}`

const curvePath = computed(() => {
  const t = Math.max(-60, Math.min(0, comp.threshold))
  const r = Math.max(1, comp.ratio)
  return [
    [xOf(-60), yOf(-60)],
    [xOf(t), yOf(t)],
    [xOf(0), yOf(Math.max(-60, t + (0 - t) / r))],
  ]
    .map((p, i) => `${i ? 'L' : 'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(' ')
})

const thrX = computed(() => xOf(Math.max(-60, Math.min(0, comp.threshold))))
const thrY = computed(() => yOf(Math.max(-60, Math.min(0, comp.threshold))))

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
    comp.threshold =
      Math.round(Math.max(-60, Math.min(0, ((svgPt(me).x - ML) / PW) * 60 - 60)) * 2) / 2
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
  const list = props.channelType === 'input' ? aoipStore.channels.inputs : aoipStore.channels.outputs
  for (const id of ids) {
    socket.emit('dsp:comp', { type: props.channelType, id, params: { enabled: enabled.value, ...comp } })
    const ch = list.find((c) => c.id === id)
    if (ch) {
      if (!ch.dsp) ch.dsp = {}
      ch.dsp.comp = { enabled: enabled.value, ...comp }
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
  const n = Number(comp[key])
  comp[key] = Math.max(d.min, Math.min(d.max, isFinite(n) ? n : d.min))
  send()
}

function init(dsp) {
  const c = dsp?.comp
  if (c === undefined) return
  enabled.value = c?.enabled ?? false
  Object.assign(comp, {
    threshold: c?.threshold ?? DEFAULTS.threshold,
    ratio: c?.ratio ?? DEFAULTS.ratio,
    knee: c?.knee ?? DEFAULTS.knee,
    attackMs: c?.attackMs ?? DEFAULTS.attackMs,
    releaseMs: c?.releaseMs ?? DEFAULTS.releaseMs,
    makeupDb: c?.makeupDb ?? DEFAULTS.makeupDb,
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
          :key="'cx' + db"
          :x1="xOf(db)"
          :y1="MT"
          :x2="xOf(db)"
          :y2="MT + PH"
          :stroke="db === 0 ? '#374055' : '#252a36'"
          :stroke-width="db === 0 ? 1 : 0.6"
        />
        <line
          v-for="db in GRID"
          :key="'cy' + db"
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
          stroke="#e65100"
          stroke-width="2"
          stroke-linejoin="round"
        />
        <text
          v-for="db in GRID"
          :key="'lx' + db"
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
          :key="'ly' + db"
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
            stroke="#e65100"
            stroke-width="6"
            opacity="0"
          />
          <line
            :x1="thrX"
            :y1="MT"
            :x2="thrX"
            :y2="MT + PH"
            stroke="#e65100"
            stroke-width="1"
            stroke-dasharray="4,3"
            opacity="0.45"
          />
          <circle
            :cx="thrX"
            :cy="thrY"
            r="6"
            fill="#e65100"
            fill-opacity="0.2"
            stroke="#e65100"
            stroke-width="1.4"
          />
          <text
            :x="thrX + 5"
            :y="MT + 10"
            font-size="7"
            fill="#e65100"
            fill-opacity="0.85"
            font-family="monospace"
          >
            {{ comp.threshold }}dB
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
          color="deep-orange-7"
          @update:model-value="toggle"
        />
        <span class="ctrl-name" style="color: #e65100">COMP</span>
        <span class="onoff" :class="enabled ? 'onoff--on' : 'onoff--off'">{{
          enabled ? 'ON' : 'OFF'
        }}</span>
      </div>
      <div class="param-list">
        <div v-for="d in PARAMS" :key="d.key" class="param-row">
          <span class="param-lbl">{{ d.label }}</span>
          <q-input
            v-model.number="comp[d.key]"
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
.gr-bar-fill { background: linear-gradient(to left, #e65100, #bf360c); }
.gr-val { font-size: 16px; color: #e65100; }
.onoff--on { color: #e65100; }
</style>
