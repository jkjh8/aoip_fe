<script setup>
import { ref, computed, onMounted } from 'vue'
import { socket } from 'src/boot/socket'
import { useAoipStore } from 'src/stores/aoip'
import LevelMeter from 'src/components/mixer/LevelMeter.vue'

const props = defineProps({
  sink: { type: Object, required: true },
})

const emit = defineEmits(['refresh'])

const aoipState = useAoipStore()
const status = ref(null)

onMounted(() => {
  socket.emit('aes67:sink:status', { id: props.sink.id }, (res) => {
    if (res?.ok) status.value = res.status
  })
})

const meterChannels = computed(() => {
  const mapSet = new Set(props.sink.map ?? [])
  return aoipState.channels.outputs
    .filter((ch) => {
      const m = ch.port?.match(/^aes67:sin_(\d+)$/)
      return m && mapSet.has(Number(m[1]) - 1)
    })
    .map((ch) => ({ level: ch.level, muted: ch.muted, label: ch.label }))
})

const sourceName = computed(() => {
  const sdpName = (props.sink.sdp ?? '').match(/^s=(.+)$/m)?.[1]?.trim()
  return sdpName || props.sink.source || '—'
})

const mapLabel = computed(() => {
  const m = props.sink.map ?? []
  if (!m.length) return '—'
  if (m.length === 1) return `Ch ${m[0] + 1}`
  return `Ch ${m[0] + 1}–${m[m.length - 1] + 1} (${m.length}ch)`
})

const delayMs = computed(() => {
  const d = props.sink.delay ?? 0
  return d ? `${d} (${(d / 48).toFixed(1)}ms)` : '—'
})

const isLocked = computed(() => {
  if (!status.value) return null
  return status.value?.is_sink_connected ?? status.value?.connected ?? null
})

function remove() {
  if (!confirm(`"${props.sink.name}" 싱크를 삭제하시겠습니까?`)) return
  socket.emit('aes67:sink:remove', { id: props.sink.id }, () => emit('refresh'))
}
</script>

<template>
  <q-card flat style="border: 1px solid #e0e0e0">
    <!-- Header -->
    <q-card-section class="q-py-sm">
      <div class="row no-wrap justify-between items-center q-gutter-x-sm">
        <div class="q-gutter-x-sm">
          <q-icon name="download" size="md" color="green-7" />
          <span class="item-title">{{ sink.name }}</span>
          <q-badge v-if="isLocked !== null" outline :color="isLocked ? 'positive' : 'warning'">
            {{ isLocked ? 'Connected' : 'Waiting' }}
          </q-badge>
        </div>
        <div class="row items-center">
          <q-btn flat round size="md" icon="delete_outline" color="negative" @click="remove">
            <q-tooltip>삭제</q-tooltip>
          </q-btn>
          <LevelMeter v-if="meterChannels.length" :channels="meterChannels" />
        </div>
      </div>
    </q-card-section>
    <q-separator />

    <q-card-section class="q-pa-none">
      <div class="st-section-label">Input</div>
      <div class="st-strip cs-wrap">
        <div class="cs-full">
          <span class="cs-key">Src</span>
          <span class="cs-val cs-mono cs-src">{{ sourceName }}</span>
        </div>
        <span class="cs-item cs-w-ch">
          <span class="cs-key">Ch</span>
          <span class="cs-val">{{ mapLabel }}</span>
        </span>
        <span class="cs-item cs-w-delay">
          <span class="cs-key">Delay</span>
          <span class="cs-val" :class="sink.delay ? '' : 'cs-muted'">{{ delayMs }}</span>
        </span>
        <span class="cs-item">
          <span class="cs-key">Refclk</span>
          <span class="cs-val">{{ sink.ignore_refclk_gmid ? 'Any GM' : 'Strict GM' }}</span>
        </span>
      </div>
    </q-card-section>

  </q-card>
</template>

<style scoped>
.item-title { font-size: 14px; font-weight: 700; color: #37474f; }

.st-section-label {
  display: flex; align-items: center; gap: 8px;
  font-size: 11px; font-weight: 700; color: #90a4ae;
  letter-spacing: 0.8px; text-transform: uppercase;
  padding: 10px 18px 5px;
}
.st-strip { padding: 8px 18px 12px; }

/* ── Compact inline stats ── */
.cs-wrap  { display: flex; flex-wrap: wrap; gap: 5px 18px; align-items: center; }
.cs-full  { flex: 0 0 100%; display: flex; gap: 6px; align-items: center; }
.cs-item  { display: flex; gap: 4px; align-items: center; white-space: nowrap; }
.cs-key   { font-size: 11px; font-weight: 700; color: #90a4ae; letter-spacing: 0.4px; }
.cs-val   {
  font-size: 12px; font-weight: 500; color: #37474f;
  font-variant-numeric: tabular-nums;
}
.cs-mono  { font-family: 'Courier New', monospace; }
.cs-src   { font-size: 11px; color: #546e7a; word-break: break-all; }
.cs-muted { color: #b0bec5; }

/* ── Fixed widths ── */
.cs-w-ch    { min-width: 100px; }
.cs-w-delay { min-width: 110px; }
</style>
