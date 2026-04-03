<script setup>
defineProps({
  channels: {
    type: Array,
    required: true,
    // Each item: { level?: Number, muted?: Boolean, label?: String }
  },
})

function levelPct(level, muted) {
  if (muted) return 0
  return Math.max(0, Math.min(100, (((level ?? -100) + 60) / 60) * 100))
}

function levelColor(level) {
  const l = level ?? -100
  if (l > -3) return '#ef5350'
  if (l > -6) return '#ffa726'
  return '#66bb6a'
}

function fmtLevel(level) {
  if (level == null || level <= -100) return '-inf'
  return (level >= 0 ? '+' : '') + level.toFixed(1) + ' dB'
}
</script>

<template>
  <div class="lm-wrap">
    <div
      v-for="(ch, i) in channels"
      :key="i"
      class="lm-bar"
      :style="channels.length === 1 ? 'width:14px' : ''"
    >
      <q-tooltip
        anchor="top middle"
        self="bottom middle"
        :offset="[0, 6]"
        class="bg-grey-4 text-grey-9"
      >
        {{ ch.label ? ch.label + ': ' : '' }}{{ ch.muted ? 'MUTE' : fmtLevel(ch.level) }}
      </q-tooltip>
      <div
        class="lm-fill"
        :style="`height:${levelPct(ch.level, ch.muted)}%; background:${levelColor(ch.level)}`"
      />
    </div>
  </div>
</template>

<style scoped>
.lm-wrap {
  display: flex;
  gap: 2px;
  align-self: stretch;
  flex-shrink: 0;
  padding: 6px 0;
}

.lm-bar {
  width: 6px;
  background: #e0e4e8;
  border-radius: 2px;
  position: relative;
  overflow: hidden;
  cursor: default;
}

.lm-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  border-radius: 2px;
  transition: height 0.1s linear;
}

:global(.body--dark) .lm-bar {
  background: #2a3f5f;
}
</style>
