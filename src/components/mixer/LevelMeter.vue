<script setup>
import { ref, watch, onUnmounted } from 'vue'

const props = defineProps({
  channels: {
    type: Array,
    required: true,
    // Each item: { level?: Number, muted?: Boolean, label?: String }
  },
  title: { type: String, default: null },
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


const peakLevels = ref([])
const peakTimers = []

watch(
  () => props.channels,
  (chs) => {
    chs.forEach((ch, i) => {
      if (ch.muted) return
      const lvl = ch.level ?? -100
      if (peakLevels.value[i] == null || lvl >= peakLevels.value[i]) {
        peakLevels.value[i] = lvl
        clearTimeout(peakTimers[i])
        peakTimers[i] = setTimeout(() => {
          peakLevels.value[i] = null
        }, 2000)
      }
    })
  },
  { deep: true }
)

onUnmounted(() => peakTimers.forEach(clearTimeout))
</script>

<template>
  <div class="lm-wrap" :style="`--bar-w:${channels.length === 1 ? 14 : 6}px`">
    <q-tooltip
      :delay="200"
      anchor="top middle"
      self="bottom middle"
      :offset="[0, 10]"
      class="bg-grey-9"
      style="padding: 0; overflow: hidden; border-radius: 6px"
    >
      <div v-if="title" style="padding:6px 10px 0;font-size:10px;font-weight:700;color:rgba(255,255,255,0.75);letter-spacing:0.4px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px">{{ title }}</div>
      <div style="padding:10px 10px 8px;display:flex;gap:4px;align-items:stretch">
        <!-- Vertical dB scale (0 at top, -60 at bottom), right-aligned -->
        <div style="position:relative;width:22px;height:130px;flex-shrink:0">
          <span style="position:absolute;top:0%;right:0;transform:translateY(-50%);font-size:8px;color:rgba(255,255,255,0.4);font-family:monospace">0</span>
          <span style="position:absolute;top:10%;right:0;transform:translateY(-50%);font-size:8px;color:rgba(255,255,255,0.4);font-family:monospace">-6</span>
          <span style="position:absolute;top:20%;right:0;transform:translateY(-50%);font-size:8px;color:rgba(255,255,255,0.4);font-family:monospace">-12</span>
          <span style="position:absolute;top:33%;right:0;transform:translateY(-50%);font-size:8px;color:rgba(255,255,255,0.4);font-family:monospace">-20</span>
          <span style="position:absolute;top:67%;right:0;transform:translateY(-50%);font-size:8px;color:rgba(255,255,255,0.4);font-family:monospace">-40</span>
          <span style="position:absolute;top:100%;right:0;transform:translateY(-50%);font-size:8px;color:rgba(255,255,255,0.4);font-family:monospace">-60</span>
        </div>
        <!-- Enlarged bars -->
        <div style="display:flex;gap:4px;height:130px">
          <div
            v-for="(ch, i) in channels"
            :key="i"
            style="width:18px;background:rgba(255,255,255,0.08);border-radius:3px;position:relative;overflow:hidden"
          >
            <div
              style="position:absolute;bottom:0;left:0;right:0;border-radius:3px;transition:height 0.1s linear"
              :style="`height:${levelPct(ch.level, ch.muted)}%;background:${levelColor(ch.level)}`"
            />
            <div
              v-if="peakLevels[i] != null"
              style="position:absolute;left:0;right:0;height:2px;border-radius:1px;filter:brightness(1.4)"
              :style="`bottom:${levelPct(peakLevels[i], false)}%;background:${levelColor(peakLevels[i])}`"
            />
          </div>
        </div>
      </div>
      <!-- Level values -->
      <div style="display:flex;gap:4px;padding:0 10px 4px 36px">
        <div
          v-for="(ch, i) in channels"
          :key="i"
          style="width:18px;font-size:8px;text-align:center;color:rgba(255,255,255,0.5);font-family:monospace;white-space:nowrap;overflow:hidden"
        >
          {{ ch.muted ? 'M' : (ch.level == null || ch.level <= -100 ? '-∞' : (ch.level >= 0 ? '+' : '') + ch.level.toFixed(0)) }}
        </div>
      </div>
      <!-- Channel labels -->
      <div style="display:flex;gap:4px;padding:0 10px 8px 36px">
        <div
          v-for="(ch, i) in channels"
          :key="i"
          style="width:18px;display:flex;justify-content:center;overflow:hidden"
        >
          <span
            v-if="ch.label"
            style="font-size:8px;color:rgba(255,255,255,0.45);font-family:monospace;writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap;max-height:44px;overflow:hidden;text-overflow:ellipsis"
          >{{ ch.label }}</span>
        </div>
      </div>
    </q-tooltip>

    <div
      v-for="(ch, i) in channels"
      :key="i"
      class="lm-bar"
    >
      <div
        class="lm-fill"
        :style="`height:${levelPct(ch.level, ch.muted)}%; background:${levelColor(ch.level)}`"
      />
      <div
        v-if="peakLevels[i] != null"
        class="lm-peak"
        :style="`bottom:${levelPct(peakLevels[i], false)}%; background:${levelColor(peakLevels[i])}`"
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
  cursor: default;
}

.lm-bar {
  width: var(--bar-w, 6px);
  background: #e0e4e8;
  border-radius: 2px;
  position: relative;
  overflow: hidden;
}

.lm-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  border-radius: 2px;
  transition: height 0.1s linear;
}

.lm-peak {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  border-radius: 1px;
  filter: brightness(1.3);
}

:global(.body--dark) .lm-bar {
  background: #2a3f5f;
}
</style>
