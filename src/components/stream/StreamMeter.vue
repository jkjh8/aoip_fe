<script setup>
import { computed } from 'vue'
import { useAoipStore } from 'src/stores/aoip'

const props = defineProps({
  type: { type: String, required: true }, // 'rtp_in' | 'rtp_out'
})

const aoipState = useAoipStore()

const channels = computed(() => {
  const all = props.type === 'rtp_in' ? aoipState.channels.inputs : aoipState.channels.outputs
  const matched = all.filter((ch) => ch.label.toLowerCase().includes('stream'))
  return matched.length ? matched : all
})

function dispLevel(ch) {
  return ch.level ?? -100
}

function levelPct(level) {
  return Math.max(0, Math.min(100, ((level + 60) / 60) * 100))
}

function levelColor(level) {
  if (level > -3) return '#ef5350'
  if (level > -12) return '#ffa726'
  return '#66bb6a'
}

function fmtLevel(level) {
  if (level <= -100) return '-inf'
  return (level >= 0 ? '+' : '') + level.toFixed(1) + ' dB'
}
</script>

<template>
  <div v-if="channels.length" class="v-meters">
    <div
      v-for="ch in channels"
      :key="ch.id"
      class="v-meter"
    >
      <q-tooltip anchor="top middle" self="bottom middle" :offset="[0, 4]" class="bg-grey-4 text-grey-9">
        {{ ch.label }}: {{ ch.muted ? 'MUTE' : fmtLevel(dispLevel(ch)) }}
      </q-tooltip>
      <div
        class="v-meter-fill"
        :style="`height:${ch.muted ? 0 : levelPct(dispLevel(ch))}%; background:${levelColor(dispLevel(ch))}`"
      />
    </div>
  </div>
</template>

<style scoped>
.v-meters {
  display: flex;
  gap: 3px;
  align-self: stretch;
  padding: 4px 8px 4px 0;
}

.v-meter {
  width: 6px;
  background: #e0e4e8;
  border-radius: 2px;
  position: relative;
  overflow: hidden;
  cursor: default;
}

.v-meter-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  border-radius: 2px;
  transition: height 0.1s linear;
}
</style>
