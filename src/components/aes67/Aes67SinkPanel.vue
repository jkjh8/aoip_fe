<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from 'src/boot/axios'

const props = defineProps({
  sink: { type: Object, required: true },
})
const emit = defineEmits(['refresh'])

const status = ref(null)

onMounted(async () => {
  try {
    const res = await api.get(`/aes67/sinks/${props.sink.id}/status`)
    status.value = res.data
  } catch { /* ignore */ }
})

// SDP에서 소스 이름 파싱
const sourceName = computed(() => {
  if (props.sink.use_sdp) {
    // URL에서 마지막 부분 추출
    return props.sink.source ?? '—'
  }
  const m = (props.sink.sdp ?? '').match(/^s=(.+)$/m)
  return m ? m[1].trim() : '—'
})

// SDP에서 codec/rate/ch 추출
const sdpFormat = computed(() => {
  const sdp = props.sink.sdp ?? ''
  const m = sdp.match(/a=rtpmap:\d+\s+(\S+)\/(\d+)(?:\/(\d+))?/)
  if (!m) return null
  return { codec: m[1], rate: Number(m[2]), channels: Number(m[3] ?? 1) }
})

const mapLabel = computed(() => {
  const m = props.sink.map ?? []
  if (!m.length) return '—'
  if (m.length === 1) return `Ch ${m[0] + 1}`
  return `Ch ${m[0] + 1} – ${m[m.length - 1] + 1} (${m.length}ch)`
})

const delayMs = computed(() => {
  const d = props.sink.delay ?? 0
  return d ? `${d} samp (${(d / 48).toFixed(1)}ms)` : '—'
})

const isLocked = computed(() => {
  if (!status.value) return null
  // 데몬 status 필드: is_sink_connected, sink_connected 등 버전마다 다름
  return status.value?.is_sink_connected ?? status.value?.connected ?? null
})

async function remove() {
  if (!confirm(`"${props.sink.name}" 싱크를 삭제하시겠습니까?`)) return
  await api.delete(`/aes67/sinks/${props.sink.id}`)
  emit('refresh')
}
</script>

<template>
  <q-card flat style="border: 1px solid #e0e0e0">
    <!-- Header -->
    <q-card-section class="q-py-sm">
      <div class="row no-wrap justify-between items-center">
        <div class="row items-center q-gutter-x-sm">
          <q-icon name="download" size="sm" color="green-7" />
          <span class="panel-title">{{ sink.name }}</span>
          <q-badge v-if="isLocked !== null" outline
            :color="isLocked ? 'positive' : 'warning'">
            {{ isLocked ? 'Connected' : 'Waiting' }}
          </q-badge>
        </div>
        <q-btn flat dense round size="sm" icon="delete_outline" color="negative" @click="remove">
          <q-tooltip>삭제</q-tooltip>
        </q-btn>
      </div>
    </q-card-section>
    <q-separator />

    <q-card-section class="q-pa-none">
      <!-- Input info -->
      <div class="st-section-label">Input</div>
      <div class="st-strip info-grid">
        <div class="info-row">
          <span class="info-key">Source</span>
          <span class="info-val source-val">{{ sourceName }}</span>
        </div>
        <div class="info-row" v-if="sdpFormat">
          <span class="info-key">Format</span>
          <span class="info-val">
            <span class="badge-tag">{{ sdpFormat.codec }}</span>
            <span class="badge-tag">{{ (sdpFormat.rate / 1000).toFixed(0) }}kHz</span>
            <span class="badge-tag">{{ sdpFormat.channels }}ch</span>
          </span>
        </div>
        <div class="info-row">
          <span class="info-key">Channels</span>
          <span class="info-val">{{ mapLabel }}</span>
        </div>
        <div class="info-row">
          <span class="info-key">Delay</span>
          <span class="info-val" :class="sink.delay ? '' : 'info-muted'">{{ delayMs }}</span>
        </div>
        <div class="info-row">
          <span class="info-key">Refclk</span>
          <span class="info-val">
            {{ sink.ignore_refclk_gmid ? 'Any GM' : 'Strict GM' }}
          </span>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<style scoped>
.panel-title { font-size: 14px; font-weight: 700; color: #37474f; }

.st-section-label {
  display: flex; align-items: center; gap: 8px;
  font-size: 11px; font-weight: 700; color: #90a4ae;
  letter-spacing: 0.8px; text-transform: uppercase;
  padding: 10px 18px 5px;
}
.st-strip { padding: 8px 18px 12px; }

.info-grid { display: flex; flex-direction: column; gap: 7px; }
.info-row  { display: flex; align-items: flex-start; font-size: 13px; }
.info-key  { font-size: 11px; font-weight: 700; color: #90a4ae; width: 60px; flex-shrink: 0; padding-top: 1px; }
.info-val  { color: #37474f; font-weight: 500; display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
.info-muted { color: #b0bec5; }

.source-val {
  font-size: 11px; color: #546e7a; word-break: break-all;
  font-family: 'Courier New', monospace;
}

.badge-tag {
  font-size: 10px; font-weight: 700; padding: 1px 6px;
  border-radius: 3px; background: #e3f2fd; color: #1565c0;
}
</style>
