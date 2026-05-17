<script setup>
import { ref, watch, onUnmounted } from 'vue'

const props = defineProps({
  level: { type: Number, default: -100 },
  muted: { type: Boolean, default: false },
  label: { type: String, default: '' },
  min: { type: Number, default: -60 },
  max: { type: Number, default: 0 },
  height: { type: Number, default: 8 },
})

function levelPct(level, muted, min, max) {
  if (muted) return 0
  return Math.max(0, Math.min(100, (((level ?? -100) - min) / (max - min)) * 100))
}

// 3-color zone stops based on min/max range
// green: min ~ -6dB, orange: -6 ~ -3dB, red: -3 ~ max
function zonePct(db, min, max) {
  return Math.max(0, Math.min(100, ((db - min) / (max - min)) * 100))
}

function fmtLevel(level) {
  if (level == null || level <= -100) return '-inf'
  return (level >= 0 ? '+' : '') + level.toFixed(1) + ' dB'
}

const peakLevel = ref(null)
let peakTimer = null

watch(
  () => [props.level, props.muted],
  ([lvl, muted]) => {
    if (muted) return
    if (peakLevel.value == null || lvl >= peakLevel.value) {
      peakLevel.value = lvl
      clearTimeout(peakTimer)
      peakTimer = setTimeout(() => {
        peakLevel.value = null
      }, 2000)
    }
  }
)

onUnmounted(() => clearTimeout(peakTimer))
</script>

<template>
  <div class="hlm-wrap">
    <div v-if="label" class="hlm-label">{{ label }}</div>
    <div class="hlm-track" :style="`height:${height}px`">
      <!-- 3-color gradient background (green → orange → red) -->
      <div
        class="hlm-bg"
        :style="`
          background: linear-gradient(to right,
            #66bb6a 0%,
            #66bb6a ${zonePct(-6, min, max)}%,
            #ffa726 ${zonePct(-6, min, max)}%,
            #ffa726 ${zonePct(-3, min, max)}%,
            #ef5350 ${zonePct(-3, min, max)}%,
            #ef5350 100%
          );
        `"
      />
      <!-- right-side mask to hide unfilled portion -->
      <div
        class="hlm-mask"
        :style="`left:${levelPct(level, muted, min, max)}%`"
      />
      <!-- peak hold indicator -->
      <div
        v-if="peakLevel != null && !muted"
        class="hlm-peak"
        :style="`left:${levelPct(peakLevel, false, min, max)}%`"
      />
    </div>
    <div class="hlm-val">{{ muted ? 'MUTE' : fmtLevel(level) }}</div>

    <!-- Hover popup -->
    <q-tooltip
      :delay="200"
      anchor="top middle"
      self="bottom middle"
      :offset="[0, 10]"
      class="bg-grey-9"
      style="padding: 0; overflow: hidden; border-radius: 6px; min-width: 240px"
    >
      <div style="padding: 10px 14px 8px">
        <!-- Header: label + value -->
        <div style="display:flex; align-items:center; margin-bottom:8px">
          <span
            v-if="label"
            style="font-size:10px;font-weight:700;letter-spacing:0.8px;color:#78909c;text-transform:uppercase"
          >{{ label }}</span>
          <span
            style="margin-left:auto;font-size:14px;font-family:monospace;font-weight:700"
            :style="muted ? 'color:#ef5350' : 'color:white'"
          >{{ muted ? 'MUTE' : fmtLevel(level) }}</span>
        </div>
        <!-- Enlarged track -->
        <div style="height:22px;border-radius:4px;overflow:hidden;position:relative;background:#111e30">
          <div
            style="position:absolute;inset:0;border-radius:4px"
            :style="`background:linear-gradient(to right,#66bb6a 0%,#66bb6a ${zonePct(-6,min,max)}%,#ffa726 ${zonePct(-6,min,max)}%,#ffa726 ${zonePct(-3,min,max)}%,#ef5350 ${zonePct(-3,min,max)}%,#ef5350 100%)`"
          />
          <div
            style="position:absolute;top:0;bottom:0;right:0;background:#111e30;border-radius:0 4px 4px 0;transition:left 0.08s linear"
            :style="`left:${levelPct(level, muted, min, max)}%`"
          />
          <div
            v-if="peakLevel != null && !muted"
            style="position:absolute;top:0;bottom:0;width:2px;background:rgba(255,255,255,0.9);box-shadow:0 0 3px rgba(0,0,0,0.5);transform:translateX(-50%);z-index:1"
            :style="`left:${levelPct(peakLevel, false, min, max)}%`"
          />
        </div>
        <!-- dB scale: labels at accurate positions -->
        <div style="position:relative;height:14px;margin-top:4px;font-size:8px;color:rgba(255,255,255,0.3);font-family:monospace">
          <span style="position:absolute;left:0;transform:translateX(0)">{{ min }}</span>
          <span style="position:absolute;transform:translateX(-50%)" :style="`left:${zonePct(-24, min, max)}%`">-24</span>
          <span style="position:absolute;transform:translateX(-50%)" :style="`left:${zonePct(-12, min, max)}%`">-12</span>
          <span style="position:absolute;transform:translateX(-50%)" :style="`left:${zonePct(-6, min, max)}%`">-6</span>
          <span style="position:absolute;right:0">0</span>
        </div>
      </div>
    </q-tooltip>
  </div>
</template>

<style scoped>
.hlm-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  cursor: default;
}

.hlm-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.8px;
  color: #78909c;
  flex-shrink: 0;
  min-width: 32px;
  text-transform: uppercase;
}

.hlm-track {
  flex: 1;
  border-radius: 4px;
  overflow: hidden;
  background: #2a3f5f;
  position: relative;
}

.hlm-bg {
  position: absolute;
  inset: 0;
  border-radius: 4px;
  transition: none;
}

.hlm-mask {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  background: #2a3f5f;
  border-radius: 0 4px 4px 0;
  transition: left 0.08s linear;
}

.hlm-peak {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.4);
  transform: translateX(-50%);
  z-index: 1;
}

.hlm-val {
  font-size: 11px;
  font-family: 'Courier New', monospace;
  font-weight: 600;
  color: #78909c;
  min-width: 58px;
  text-align: right;
  flex-shrink: 0;
}

/* Light mode track background */
:global(.body--light) .hlm-track,
:global(.body--light) .hlm-mask {
  background: #e0e4e8;
}
</style>
