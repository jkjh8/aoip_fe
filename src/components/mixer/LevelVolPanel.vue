<script setup>
import { ref, computed, watch } from 'vue'
import { socket } from 'src/boot/socket'
import { useAoipStore } from 'src/stores/aoip'
import { gainToDb, dbToGain } from 'src/composables/useChannelControl'
import LevelMeter from './LevelMeter.vue'

const props = defineProps({
  channel: Object,
  channelRight: Object,
  channelType: { type: String, default: 'input' },
})

const aoipStore = useAoipStore()

const levelVal = computed(() => {
  const list =
    props.channelType === 'input' ? aoipStore.channels.inputs : aoipStore.channels.outputs
  return list.find((c) => c.id === props.channel?.id)?.level ?? -120
})
const levelValRight = computed(() => {
  const list =
    props.channelType === 'input' ? aoipStore.channels.inputs : aoipStore.channels.outputs
  return list.find((c) => c.id === props.channelRight?.id)?.level ?? -120
})

const volDb = ref(0)
const mutedLocal = ref(false)

function setVol(db) {
  volDb.value = db
  const gain = dbToGain(db)
  const ids = [props.channel?.id, props.channelRight?.id].filter(Boolean)
  for (const id of ids) socket.emit('ch:gain', { type: props.channelType, id, gain })
}

function toggleMute() {
  mutedLocal.value = !mutedLocal.value
  const ids = [props.channel?.id, props.channelRight?.id].filter(Boolean)
  for (const id of ids)
    socket.emit('ch:mute', { type: props.channelType, id, muted: mutedLocal.value })
}

function init() {
  if (!props.channel) return
  volDb.value = gainToDb(props.channel.gain ?? 100)
  mutedLocal.value = props.channel.muted ?? false
}

watch(
  () => props.channel?.id,
  () => init(),
)

defineExpose({ init })
</script>

<template>
  <div class="level-col">
    <div class="lc-meter-area">
      <div class="lc-hdr">LEVEL</div>
      <LevelMeter
        style="flex: 1; min-height: 0"
        :channels="
          channelRight
            ? [
                { level: levelVal, muted: mutedLocal, label: 'L' },
                { level: levelValRight, muted: mutedLocal, label: 'R' },
              ]
            : [{ level: levelVal, muted: mutedLocal }]
        "
        no-tooltip
      />
      <div class="lc-level-val">{{ levelVal > -119 ? levelVal.toFixed(1) : '---' }}</div>
    </div>
    <div class="lc-vol-area">
      <div class="lc-hdr">VOL</div>
      <q-slider
        :model-value="Number.isFinite(volDb) ? volDb : 0"
        :min="-60"
        :max="12"
        :step="0.5"
        vertical
        reverse
        thumb-size="24px"
        color="blue-8"
        class="vol-fader-v"
        @update:model-value="setVol"
        @wheel.prevent="
          setVol(Math.max(-60, Math.min(12, volDb + ($event.deltaY < 0 ? 1 : -1) * 0.5)))
        "
      />
      <div class="lc-vol-row">
        <q-input
          v-model.number="volDb"
          type="number"
          dense
          outlined
          class="vol-q-inp"
          @blur="setVol(Math.max(-60, Math.min(12, isFinite(volDb) ? volDb : 0)))"
          @keydown.enter="$event.target.blur()"
        />
        <q-btn
          style="min-width: 64px"
          :icon="mutedLocal ? 'volume_off' : 'volume_up'"
          :color="mutedLocal ? 'negative' : 'blue-grey-3'"
          unelevated
          dense
          size="sm"
          padding="6px 6px"
          @click="toggleMute"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.level-col {
  width: 160px;
  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  background: #eef1f8;
  border-left: 1px solid #d0d8e8;
  overflow: hidden;
  margin: auto, 20px;
}
.lc-hdr {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1.4px;
  color: #5a6a8a;
  text-transform: uppercase;
  text-align: center;
  padding: 12px 4px 4px 8px;
  flex-shrink: 0;
}
.lc-meter-area {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 24px 0;
  overflow: hidden;
  border-right: 1px solid #d0d8e8;
}
.lc-level-val {
  font-size: 12px;
  font-family: 'Courier New', monospace;
  font-weight: 700;
  color: #7a8aa4;
  text-align: center;
  margin: 8px 4px 52px 4px;
  flex-shrink: 0;
}
.lc-vol-area {
  width: 80px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 8px 10px;
  gap: 5px;
}
.vol-fader-v {
  width: 36px;
  flex: 1;
  min-height: 90px;
}
.lc-vol-row {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: center;
}
.vol-q-inp {
  width: 64px;
}
.vol-q-inp :deep(.q-field__control) {
  height: 28px;
  background: #ffffff;
}
.vol-q-inp :deep(input) {
  font-size: 12px;
  font-family: 'Courier New', monospace;
  text-align: right;
  color: #1e2840;
  appearance: textfield;
  -moz-appearance: textfield;
}
.vol-q-inp :deep(input::-webkit-inner-spin-button) {
  display: none;
}
.vol-q-inp :deep(.q-field__suffix) {
  font-size: 12px;
  color: #8a9ab4;
  padding-left: 2px;
}
</style>
