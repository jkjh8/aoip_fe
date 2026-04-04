<script setup>
defineProps({
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
    </div>
    <div class="hlm-val">{{ muted ? 'MUTE' : fmtLevel(level) }}</div>
  </div>
</template>

<style scoped>
.hlm-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
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
