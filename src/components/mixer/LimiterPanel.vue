<script setup>
import { ref, watch, onUnmounted, computed } from 'vue'
import { socket } from 'src/boot/socket'

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
const grPct = computed(() => (gr.value / 30) * 100)

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

// ── Direct number input handlers ───────────────────────────
function setThreshold(val) {
  threshold.value = Math.max(-30, Math.min(0, Number(val) || 0))
  send()
}
function setAttack(val) {
  attack.value = Math.max(0.1, Math.min(50, Number(val) || 0.1))
  send()
}
function setRelease(val) {
  release.value = Math.max(10, Math.min(1000, Number(val) || 10))
  send()
}
function setMakeup(val) {
  makeup.value = Math.max(0, Math.min(20, Number(val) || 0))
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
        <!-- Enable + GR meter -->
        <div class="row items-center q-mb-lg" style="gap: 16px">
          <q-toggle
            :model-value="enabled"
            checked-icon="check"
            unchecked-icon="close"
            dense
            color="red-8"
            @update:model-value="toggle"
          />
          <div class="gr-meter-wrap">
            <div class="gr-label">GR</div>
            <div class="gr-track">
              <div class="gr-fill" :style="`width:${grPct}%`" />
            </div>
            <div class="gr-val">{{ fmtGr(gr) }}</div>
          </div>
        </div>
        <div class="column q-gutter-y-sm">
          <!-- Threshold -->
          <div class="row justify-between items-center">
            <div class="label">Threshold</div>
            <div class="row no-wrap q-gutter-x-xs items-center">
              <q-input
                class="row-input"
                outlined
                type="number"
                v-model="threshold"
                min="-30"
                max="0"
                step="0.5"
                :disabled="!enabled"
                @update:model-value="setThreshold($event)"
              />
              <span class="text-caption text-blue-grey-5" style="width: 32px">dBFS</span>
            </div>
          </div>

          <!-- Attack / Release / Makeup (가로 배치) -->
          <!-- Attack -->
          <div class="row justify-between items-center">
            <div class="label">Attack</div>
            <div class="row items-center q-gutter-x-xs">
              <q-input
                v-model="attack"
                outlined
                type="number"
                class="row-input"
                min="0.1"
                max="50"
                step="0.1"
                :disabled="!enabled"
                @update:model-value="setAttack($event)"
              />
              <span class="text-caption text-blue-grey-5" style="width: 32px">ms</span>
            </div>
          </div>

          <!-- Release -->
          <div class="row justify-between items-center">
            <div class="label">Release</div>
            <div class="row items-center q-gutter-x-xs">
              <q-input
                v-model="release"
                outlined
                type="number"
                class="row-input"
                min="10"
                max="1000"
                step="10"
                :disabled="!enabled"
                @update:model-value="setRelease($event)"
              />
              <span class="text-caption text-blue-grey-5" style="width: 32px">ms</span>
            </div>
          </div>

          <!-- Makeup -->
          <div class="row justify-between items-center">
            <div class="label">Makeup</div>
            <div class="row items-center q-gutter-x-xs">
              <q-input
                v-model="makeup"
                outlined
                type="number"
                class="row-input"
                min="0"
                max="20"
                step="0.5"
                :disabled="!enabled"
                @update:model-value="setMakeup($event)"
              />
              <span class="text-caption text-blue-grey-5" style="width: 32px">dB</span>
            </div>
          </div>
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
  background: #ef5350;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}
.ctrl-range::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #ef5350;
  border: none;
  cursor: pointer;
}
.ctrl-range:disabled {
  opacity: 0.35;
  cursor: default;
}

.ctrl-unit {
  font-size: 11px;
  color: #90a4ae;
  width: 32px;
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
.ctrl-num:disabled {
  opacity: 0.35;
  cursor: default;
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
