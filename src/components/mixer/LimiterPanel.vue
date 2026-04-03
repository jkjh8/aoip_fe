<script setup>
import { ref, watch, onUnmounted, computed } from 'vue'
import { socket } from 'src/boot/socket'
import { useAoipStore } from 'src/stores/aoip'
import { storeToRefs } from 'pinia'

const aoipStore = useAoipStore()
const { channels } = storeToRefs(aoipStore)

const props = defineProps({
  modelValue: Boolean,
  channel: Object, // 기준 채널 (mono 또는 stereo left)
  channelRight: Object, // 스테레오 right (없으면 null)
})
const emit = defineEmits(['update:modelValue'])

// ── Defaults ──────────────────────────────────────────────
const DEFAULT = { enabled: false, threshold: -6, attack: 1, release: 100, makeup: 0 }

// ── State ──────────────────────────────────────────────────
const enabled = ref(DEFAULT.enabled)
const threshold = ref(DEFAULT.threshold)
const attack = ref(DEFAULT.attack)
const release = ref(DEFAULT.release)
const makeup = ref(DEFAULT.makeup)

// ── Limiter meter feedback ─────────────────────────────────
// { pre: dB, post: dB } — levels 이벤트로 수신
const limMeter = ref(null)
const gr = computed(() => {
  if (!limMeter.value) return 0
  const v = limMeter.value.pre - limMeter.value.post
  return Math.max(0, Math.min(30, v))
})
const grPct = computed(() => {
  if (enabled.value) {
    return (gr.value / 30) * 100
  } else {
    return 0
  }
})

// ── Level meter (input level) ──────────────────────────────
const levelVal = computed(() => {
  return channels.value.outputs[props.channel.id - 1].level ?? -60
})
const levelPct = computed(() => {
  return Math.max(0, Math.min(100, ((levelVal.value + 60) / 60) * 100))
})

// ── Init from channel DSP state ────────────────────────────
function initFromChannel() {
  if (!props.channel) return
  const lim = props.channel.dsp?.limiter
  enabled.value = lim?.enabled ?? DEFAULT.enabled
  threshold.value = lim?.threshold ?? DEFAULT.threshold
  attack.value = lim?.attack ?? DEFAULT.attack
  release.value = lim?.release ?? DEFAULT.release
  makeup.value = lim?.makeup ?? DEFAULT.makeup
}

// ── limiter:watch 구독/해제 ────────────────────────────────
function watchLimiter(on) {
  const ids = [props.channel?.id, props.channelRight?.id].filter(Boolean)
  for (const id of ids) socket.emit('limiter:watch', { id, watch: on })
}

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      initFromChannel()
      watchLimiter(true)
    } else {
      watchLimiter(false)
      limMeter.value = null
    }
  },
)
watch(() => props.channel?.dsp?.limiter, initFromChannel, { deep: true })

// levels 이벤트에서 limiter 피드백 수신
function onLevels(data) {
  if (!props.modelValue || !props.channel) return
  const out = data.outputs?.find((o) => o.id === props.channel.id)
  if (out?.limiter !== undefined) limMeter.value = out.limiter
}
socket.on('levels', onLevels)
onUnmounted(() => {
  socket.off('levels', onLevels)
  watchLimiter(false)
})

// ── Socket emit ────────────────────────────────────────────
function emitLimiter(payload) {
  const ids = [props.channel?.id, props.channelRight?.id].filter(Boolean)
  for (const id of ids) socket.emit('dsp:limiter', { ...payload, id })
}

function send() {
  emitLimiter({
    enabled: enabled.value,
    threshold: threshold.value,
    attack: attack.value,
    release: release.value,
    makeup: makeup.value,
  })
}

function toggle() {
  enabled.value = !enabled.value
  send()
}

// ── Formatting ─────────────────────────────────────────────
function fmtGr(v) {
  return v < 0.1 ? '0.0 dB' : '-' + v.toFixed(1) + ' dB'
}

// ── Parameter definitions ──────────────────────────────────
const paramDefs = [
  { key: 'threshold', label: 'Threshold', min: -30, max: 0, step: 0.5, unit: 'dBFS' },
  { key: 'attack', label: 'Attack', min: 0.1, max: 50, step: 0.1, unit: 'ms' },
  { key: 'release', label: 'Release', min: 10, max: 1000, step: 10, unit: 'ms' },
  { key: 'makeup', label: 'Makeup', min: 0, max: 20, step: 0.5, unit: 'dB' },
]

// ── Parameter getter ──────────────────────────────────────
function getParamValue(key) {
  switch (key) {
    case 'threshold':
      return threshold.value
    case 'attack':
      return attack.value
    case 'release':
      return release.value
    case 'makeup':
      return makeup.value
    default:
      return 0
  }
}

// ── Generic parameter setter ────────────────────────────────
function setParam(key, val) {
  const def = paramDefs.find((d) => d.key === key)
  if (!def) return
  const num = Math.max(def.min, Math.min(def.max, Number(val) || def.min))
  switch (key) {
    case 'threshold':
      threshold.value = num
      break
    case 'attack':
      attack.value = num
      break
    case 'release':
      release.value = num
      break
    case 'makeup':
      makeup.value = num
      break
  }
  send()
}
</script>

<template>
  <q-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <q-card class="lim-card">
      <!-- Header -->
      <q-card-section class="row justify-start items-center no-wrap q-gutter-x-sm q-py-md q-px-md">
        <q-icon name="compress" size="1.4rem" color="blue-grey-5" />
        <span class="item-title">LIMITER</span>
        <span class="chname">{{ channel?.label }}</span>
        <q-space />
        <q-btn flat round dense icon="close" size="sm" @click="emit('update:modelValue', false)" />
      </q-card-section>
      <q-separator />

      <q-card-section class="q-pt-md q-pb-lg q-px-lg">
        <!-- Enable + Meters (Level + GR) -->
        <div class="row no-wrap items-center q-mb-lg" style="gap: 16px">
          <q-toggle
            :model-value="enabled"
            checked-icon="check"
            unchecked-icon="close"
            dense
            color="red-8"
            @update:model-value="toggle"
          />
          <!-- Level Meter -->
          <div class="column" style="width: 90%">
            <div class="gr-meter-wrap">
              <div class="gr-label" style="color: #42a5f5; width: 24px">Level</div>
              <div class="gr-track">
                <div
                  class="gr-fill"
                  :style="`width:${levelPct}%;background:linear-gradient(to right,#42a5f5,#1e88e5)`"
                />
              </div>
              <div class="gr-val">{{ levelVal }}</div>
            </div>
            <!-- GR Meter -->
            <div class="gr-meter-wrap">
              <div class="gr-label" style="width: 24px">GR</div>
              <div class="gr-track">
                <div class="gr-fill" :style="`width:${grPct}%`" />
              </div>
              <div class="gr-val">{{ fmtGr(gr) }}</div>
            </div>
          </div>
        </div>

        <!-- Parameter Inputs -->
        <div class="column q-gutter-y-sm">
          <template
            v-for="(row, rowIdx) in [paramDefs.slice(0, 2), paramDefs.slice(2, 4)]"
            :key="rowIdx"
          >
            <div class="row items-center q-gutter-x-md">
              <div
                v-for="param in row"
                :key="param.key"
                class="row q-gutter-x-sm items-center flex-1"
              >
                <div class="param-label">{{ param.label }}</div>
                <div class="row items-center q-gutter-x-xs">
                  <q-input
                    :model-value="getParamValue(param.key)"
                    outlined
                    type="number"
                    class="row-input"
                    :min="param.min"
                    :max="param.max"
                    :step="param.step"
                    :disabled="!enabled"
                    @update:model-value="setParam(param.key, $event)"
                  />
                  <span class="text-caption text-blue-grey-5" style="width: 32px">{{
                    param.unit
                  }}</span>
                </div>
              </div>
            </div>
          </template>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.lim-card {
  min-width: 300px;
  max-width: 500px;
  width: 50%;
}
/* GR meter */
.gr-meter-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}
.gr-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #ef5350;
  flex-shrink: 0;
}
.gr-track {
  flex: 1;
  height: 8px;
  background: #2a2a3a;
  border-radius: 4px;
  overflow: hidden;
}
.gr-fill {
  height: 100%;
  background: linear-gradient(to right, #ffa726, #ef5350);
  border-radius: 4px;
  transition: width 0.08s linear;
}
.gr-val {
  font-size: 11px;
  font-family: 'Courier New', monospace;
  font-weight: 700;
  color: #ef5350;
  min-width: 52px;
  text-align: right;
  flex-shrink: 0;
}

/* Controls */
.param-label {
  font-size: 11px;
  font-weight: 600;
  color: #546e7a;
  letter-spacing: 0.3px;
  width: 80px;
  flex-shrink: 0;
}

.row-input {
  width: 72px;
  height: 28px;
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
