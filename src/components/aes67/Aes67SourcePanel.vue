<script setup>
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { socket } from 'src/boot/socket'
import { useAoipStore } from 'src/stores/aoip'
import LevelMeter from 'src/components/mixer/LevelMeter.vue'
import Aes67SourceEditDialog from 'src/components/aes67/Aes67SourceEditDialog.vue'

const props = defineProps({
  source: { type: Object, required: true },
})

const emit = defineEmits(['refresh'])

const $q = useQuasar()
const aoipState = useAoipStore()

const busy = ref(false)
const showSdp = ref(false)
const sdpText = ref('')

const meterChannels = computed(() => {
  const aes67Chs = aoipState.channels.outputs.filter((ch) =>
    ch.label.toLowerCase().includes('aes67'),
  )
  return (props.source.map ?? [])
    .map((idx) => aes67Chs[idx])
    .filter(Boolean)
    .map((ch) => ({ level: ch.level, muted: ch.muted, label: ch.label }))
})

const mapLabel = computed(() => {
  const m = props.source.map ?? []
  if (!m.length) return '—'
  if (m.length === 1) return `Ch ${m[0] + 1}`
  return `Ch ${m[0] + 1}–${m[m.length - 1] + 1} (${m.length}ch)`
})

function sppMs(n) {
  const ms = n / 48
  return ms < 1 ? `${(ms * 1000) | 0}μs` : `${ms}ms`
}

function patch(fields) {
  if (busy.value) return
  busy.value = true
  const { id, ...rest } = props.source
  socket.emit('aes67:source:add', { id, ...rest, ...fields }, (res) => {
    busy.value = false
    if (!res?.ok) console.error('[aes67] source patch failed', res?.error)
  })
}

function openEdit() {
  $q.dialog({ component: Aes67SourceEditDialog, componentProps: { source: props.source } })
}

function remove() {
  if (!confirm(`"${props.source.name}" 소스를 삭제하시겠습니까?`)) return
  socket.emit('aes67:source:remove', { id: props.source.id }, () => emit('refresh'))
}

function viewSdp() {
  socket.emit('aes67:source:sdp', { id: props.source.id }, (res) => {
    sdpText.value = res?.ok
      ? typeof res.sdp === 'string'
        ? res.sdp
        : JSON.stringify(res.sdp, null, 2)
      : `Error: ${res?.error ?? 'unknown'}`
    showSdp.value = true
  })
}
</script>

<template>
  <q-card flat style="border: 1px solid #e0e0e0">
    <!-- Header -->
    <q-card-section class="q-py-sm">
      <div class="row no-wrap justify-between items-center q-gutter-x-sm">
        <div class="q-gutter-x-sm">
          <q-icon name="upload" size="sm" color="blue-7" />
          <span class="item-title">{{ source.name }}</span>
          <q-badge outline :color="source.enabled ? 'positive' : 'grey-5'">
            {{ source.enabled ? 'ON' : 'OFF' }}
          </q-badge>
        </div>
        <div class="row items-center">
          <q-icon size="sm" name="data_object" color="grey-6" @click="viewSdp">
            <q-tooltip>SDP 보기</q-tooltip>
          </q-icon>
          <q-icon size="sm" name="edit" color="grey-6" @click="openEdit">
            <q-tooltip>수정</q-tooltip>
          </q-icon>
          <q-icon
            size="sm"
            :name="source.enabled ? 'pause_circle' : 'play_circle'"
            :color="source.enabled ? 'orange-7' : 'positive'"
            :loading="busy"
            @click="patch({ enabled: !source.enabled })"
          >
            <q-tooltip>{{ source.enabled ? 'Disable' : 'Enable' }}</q-tooltip>
          </q-icon>
          <q-icon size="sm" name="delete_outline" color="negative" @click="remove">
            <q-tooltip>삭제</q-tooltip>
          </q-icon>
          <LevelMeter
            style="height: 40px; margin-left: 1rem"
            v-if="meterChannels.length"
            :channels="meterChannels"
            :title="source.name"
          />
        </div>
      </div>
    </q-card-section>
    <q-separator />

    <q-card-section class="q-pa-none">
      <div class="st-section-label">Output</div>
      <div class="st-strip cs-wrap">
        <span class="cs-item cs-w-addr">
          <span class="cs-key">Addr</span>
          <span class="cs-val cs-mono">{{ source.address }}</span>
        </span>
        <span class="cs-item">
          <span class="cs-key">Codec</span>
          <span class="cs-val">{{ source.codec }}</span>
        </span>
        <span class="cs-item">
          <span class="cs-key">Pkt</span>
          <span class="cs-val"
            >{{ source.max_samples_per_packet
            }}<span class="cs-sub"> ({{ sppMs(source.max_samples_per_packet) }})</span></span
          >
        </span>
        <span class="cs-item">
          <span class="cs-key">Ch</span>
          <span class="cs-val">{{ mapLabel }}</span>
        </span>
        <span class="cs-item">
          <span class="cs-key">TTL</span>
          <span class="cs-val">{{ source.ttl ?? 15 }}</span>
        </span>
      </div>
    </q-card-section>
  </q-card>

  <!-- SDP dialog -->
  <q-dialog v-model="showSdp">
    <q-card style="min-width: 500px; max-width: 90vw">
      <q-card-section class="dialog-head">
        <span class="dialog-title">SDP — {{ source.name }}</span>
      </q-card-section>
      <q-separator />
      <q-card-section>
        <pre class="sdp-text">{{ sdpText }}</pre>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="닫기" color="grey-7" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.item-title {
  font-size: 14px;
  font-weight: 700;
  color: #37474f;
}

.st-section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  color: #90a4ae;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  padding: 10px 18px 5px;
}
.st-strip {
  padding: 8px 18px 12px;
}

/* ── Compact inline stats ── */
.cs-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 18px;
  align-items: center;
}
.cs-item {
  display: flex;
  gap: 4px;
  align-items: center;
  white-space: nowrap;
}
.cs-key {
  font-size: 11px;
  font-weight: 700;
  color: #90a4ae;
  letter-spacing: 0.4px;
}
.cs-val {
  font-size: 12px;
  font-weight: 500;
  color: #37474f;
  font-variant-numeric: tabular-nums;
}
.cs-mono {
  font-family: 'Courier New', monospace;
  color: #1565c0;
}
.cs-sub {
  font-size: 10px;
  color: #90a4ae;
}
.cs-w-addr {
  min-width: 130px;
}

.sdp-text {
  font-family: 'Courier New', monospace;
  font-size: 11px;
  color: #546e7a;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  background: #f5f7f9;
  padding: 12px;
  border-radius: 4px;
}
</style>
