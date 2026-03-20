<script setup>
import { ref, watch, onUnmounted, computed } from 'vue'
import { socket } from 'src/boot/socket'

const props = defineProps({
  modelValue: Boolean,
  channel: Object,      // 기준 채널 (mono 또는 stereo left)
  channelRight: Object, // 스테레오 right (없으면 null)
})
const emit = defineEmits(['update:modelValue'])

// ── Defaults ──────────────────────────────────────────────
const DEFAULT = { enabled: false, threshold: -6, attack: 1, release: 100, makeup: 0 }

// ── State ──────────────────────────────────────────────────
const enabled   = ref(DEFAULT.enabled)
const threshold = ref(DEFAULT.threshold)
const attack    = ref(DEFAULT.attack)
const release   = ref(DEFAULT.release)
const makeup    = ref(DEFAULT.makeup)

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
  enabled.value   = lim?.enabled   ?? DEFAULT.enabled
  threshold.value = lim?.threshold ?? DEFAULT.threshold
  attack.value    = lim?.attack    ?? DEFAULT.attack
  release.value   = lim?.release   ?? DEFAULT.release
  makeup.value    = lim?.makeup    ?? DEFAULT.makeup
}

// ── limiter:watch 구독/해제 ────────────────────────────────
function watchLimiter(on) {
  const ids = [props.channel?.id, props.channelRight?.id].filter(Boolean)
  for (const id of ids) socket.emit('limiter:watch', { id, watch: on })
}

watch(() => props.modelValue, (v) => {
  if (v) {
    initFromChannel()
    watchLimiter(true)
  } else {
    watchLimiter(false)
    limMeter.value = null
  }
})
watch(() => props.channel?.dsp?.limiter, initFromChannel, { deep: true })

// levels 이벤트에서 limiter 피드백 수신
function onLevels(data) {
  if (!props.modelValue || !props.channel) return
  const out = data.outputs?.find(o => o.id === props.channel.id)
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
    enabled:   enabled.value,
    threshold: threshold.value,
    attack:    attack.value,
    release:   release.value,
    makeup:    makeup.value,
  })
}

function toggle() {
  enabled.value = !enabled.value
  send()
}

// ── Formatting ─────────────────────────────────────────────
function fmtThreshold(v) {
  return (v >= 0 ? '+' : '') + Number(v).toFixed(1) + ' dBFS'
}
function fmtMs(v) {
  return v < 1000 ? Number(v).toFixed(v < 10 ? 1 : 0) + ' ms' : (v / 1000).toFixed(2) + ' s'
}
function fmtDb(v) {
  return (v > 0 ? '+' : '') + Number(v).toFixed(1) + ' dB'
}
function fmtGr(v) {
  return v < 0.1 ? '0.0 dB' : '-' + v.toFixed(1) + ' dB'
}
</script>

<template>
  <q-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <q-card class="lim-card">
      <!-- Header -->
      <q-card-section class="row items-center no-wrap q-py-sm q-px-md">
        <q-icon name="compress" size="18px" color="blue-grey-5" class="q-mr-xs" />
        <span class="lim-title">LIMITER</span>
        <span class="lim-chname">{{ channel?.label }}</span>
        <q-space />
        <q-btn flat round dense icon="close" size="sm" @click="emit('update:modelValue', false)" />
      </q-card-section>
      <q-separator />

      <q-card-section class="q-pt-md q-pb-lg">

        <!-- Enable + GR meter -->
        <div class="row items-center q-mb-lg" style="gap:16px">
          <q-toggle
            :model-value="enabled"
            checked-icon="check"
            unchecked-icon="close"
            dense color="red-8"
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

        <!-- Threshold -->
        <div class="ctrl-row q-mb-md">
          <div class="ctrl-head">
            <span class="ctrl-label">THRESHOLD</span>
            <span class="ctrl-val" :class="enabled ? 'ctrl-val--active' : ''">
              {{ fmtThreshold(threshold) }}
            </span>
          </div>
          <input type="range" class="ctrl-range"
            :value="threshold" min="-30" max="0" step="0.5"
            :disabled="!enabled"
            @input="threshold = Number($event.target.value)"
            @change="send"
          />
          <div class="ctrl-tick-row">
            <span v-for="t in [-30,-24,-18,-12,-6,0]" :key="t" class="ctrl-tick">{{ t }}</span>
          </div>
        </div>

        <!-- Attack / Release / Makeup (가로 배치) -->
        <div class="row q-gutter-md">

          <!-- Attack -->
          <div class="col ctrl-row">
            <div class="ctrl-head">
              <span class="ctrl-label">ATTACK</span>
              <span class="ctrl-val" :class="enabled ? 'ctrl-val--active' : ''">
                {{ fmtMs(attack) }}
              </span>
            </div>
            <input type="range" class="ctrl-range"
              :value="attack" min="0.1" max="50" step="0.1"
              :disabled="!enabled"
              @input="attack = Number($event.target.value)"
              @change="send"
            />
            <div class="ctrl-tick-row">
              <span v-for="t in ['0.1','5','10','20','50']" :key="t" class="ctrl-tick">{{ t }}</span>
            </div>
          </div>

          <!-- Release -->
          <div class="col ctrl-row">
            <div class="ctrl-head">
              <span class="ctrl-label">RELEASE</span>
              <span class="ctrl-val" :class="enabled ? 'ctrl-val--active' : ''">
                {{ fmtMs(release) }}
              </span>
            </div>
            <input type="range" class="ctrl-range"
              :value="release" min="10" max="1000" step="10"
              :disabled="!enabled"
              @input="release = Number($event.target.value)"
              @change="send"
            />
            <div class="ctrl-tick-row">
              <span v-for="t in ['10ms','100ms','500ms','1s']" :key="t" class="ctrl-tick">{{ t }}</span>
            </div>
          </div>

          <!-- Makeup -->
          <div class="col ctrl-row">
            <div class="ctrl-head">
              <span class="ctrl-label">MAKEUP</span>
              <span class="ctrl-val" :class="enabled ? 'ctrl-val--active' : ''">
                {{ fmtDb(makeup) }}
              </span>
            </div>
            <input type="range" class="ctrl-range"
              :value="makeup" min="0" max="20" step="0.5"
              :disabled="!enabled"
              @input="makeup = Number($event.target.value)"
              @change="send"
            />
            <div class="ctrl-tick-row">
              <span v-for="t in ['0','5','10','15','20']" :key="t" class="ctrl-tick">{{ t }}</span>
            </div>
          </div>

        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.lim-card {
  min-width: 380px;
  max-width: 440px;
  width: 100%;
}
.lim-title {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1.5px;
  color: #37474f;
  margin-right: 8px;
}
.lim-chname {
  font-size: 12px;
  font-weight: 400;
  color: #78909c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
.ctrl-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ctrl-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.ctrl-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #90a4ae;
}
.ctrl-val {
  font-size: 14px;
  font-family: 'Courier New', monospace;
  font-weight: 700;
  color: #b0bec5;
  transition: color 0.15s;
}
.ctrl-val--active { color: #ef5350; }

.ctrl-range {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 18px;
  background: transparent;
  cursor: pointer;
  padding: 0; margin: 0;
}
.ctrl-range:disabled { opacity: 0.35; cursor: default; }
.ctrl-range::-webkit-slider-runnable-track {
  height: 3px; background: #cfd8dc; border-radius: 2px;
}
.ctrl-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #ef5350;
  cursor: pointer;
  margin-top: -6.5px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.25);
}
.ctrl-range::-moz-range-track { height: 3px; background: #cfd8dc; border-radius: 2px; }
.ctrl-range::-moz-range-thumb {
  width: 16px; height: 16px; border-radius: 50%;
  background: #ef5350; border: none; cursor: pointer;
}
.ctrl-range:disabled::-webkit-slider-thumb { background: #b0bec5; }
.ctrl-range:disabled::-moz-range-thumb { background: #b0bec5; }

.ctrl-tick-row {
  display: flex;
  justify-content: space-between;
  padding: 0 2px;
}
.ctrl-tick {
  font-size: 9px;
  color: #b0bec5;
}
</style>
