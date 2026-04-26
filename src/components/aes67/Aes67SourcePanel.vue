<script setup>
import { ref, computed } from 'vue'
import { api } from 'src/boot/axios'

const props = defineProps({
  source: { type: Object, required: true },
})
const emit = defineEmits(['refresh'])

const busy    = ref(false)
const showSdp = ref(false)
const sdpText = ref('')

const codecOptions = ['L16', 'L24', 'AM824']
const sppOptions   = [12, 24, 48, 96, 192]

const mapLabel = computed(() => {
  const m = props.source.map ?? []
  if (!m.length) return '—'
  if (m.length === 1) return `Ch ${m[0] + 1}`
  return `Ch ${m[0] + 1} – ${m[m.length - 1] + 1} (${m.length}ch)`
})

function sppMs(n) {
  const ms = (n / 48)
  return ms < 1 ? `${ms * 1000 | 0}μs` : `${ms}ms`
}

async function patch(fields) {
  if (busy.value) return
  busy.value = true
  const { id, ...rest } = props.source
  try {
    await api.put(`/aes67/sources/${id}`, { ...rest, ...fields })
    emit('refresh')
  } finally { busy.value = false }
}

async function remove() {
  if (!confirm(`"${props.source.name}" 소스를 삭제하시겠습니까?`)) return
  await api.delete(`/aes67/sources/${props.source.id}`)
  emit('refresh')
}

async function viewSdp() {
  try {
    const res = await api.get(`/aes67/sources/${props.source.id}/sdp`)
    sdpText.value = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2)
    showSdp.value = true
  } catch (e) {
    sdpText.value = `Error: ${e.message}`
    showSdp.value = true
  }
}
</script>

<template>
  <q-card flat style="border: 1px solid #e0e0e0">
    <!-- Header -->
    <q-card-section class="q-py-sm">
      <div class="row no-wrap justify-between items-center">
        <div class="row items-center q-gutter-x-sm">
          <q-icon name="upload" size="sm" color="blue-7" />
          <span class="panel-title">{{ source.name }}</span>
          <q-badge outline :color="source.enabled ? 'positive' : 'grey-5'">
            {{ source.enabled ? 'ON' : 'OFF' }}
          </q-badge>
        </div>
        <div class="row items-center q-gutter-x-xs">
          <q-btn flat dense round size="sm" icon="data_object" color="grey-6" @click="viewSdp">
            <q-tooltip>SDP 보기</q-tooltip>
          </q-btn>
          <q-btn flat dense round size="sm"
            :icon="source.enabled ? 'pause_circle' : 'play_circle'"
            :color="source.enabled ? 'orange-7' : 'positive'"
            :loading="busy"
            @click="patch({ enabled: !source.enabled })">
            <q-tooltip>{{ source.enabled ? 'Disable' : 'Enable' }}</q-tooltip>
          </q-btn>
          <q-btn flat dense round size="sm" icon="delete_outline" color="negative" @click="remove">
            <q-tooltip>삭제</q-tooltip>
          </q-btn>
        </div>
      </div>
    </q-card-section>
    <q-separator />

    <q-card-section class="q-pa-none">
      <!-- Output info -->
      <div class="st-section-label">Output</div>
      <div class="st-strip stat-row">
        <div class="stat-item">
          <span class="stat-key">Address</span>
          <span class="stat-val stat-active font-mono">{{ source.address }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-key">Channels</span>
          <span class="stat-val stat-active">{{ mapLabel }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-key">TTL</span>
          <span class="stat-val">{{ source.ttl ?? 15 }}</span>
        </div>
      </div>
      <q-separator />

      <!-- Format -->
      <div class="st-section-label">Format</div>
      <div class="st-strip fmt-section">
        <div class="fmt-row">
          <span class="fmt-key">Codec</span>
          <div class="seg-group">
            <button v-for="c in codecOptions" :key="c"
              class="seg-btn" :class="{ 'seg-btn--on': source.codec === c }"
              @click="patch({ codec: c })">{{ c }}</button>
          </div>
        </div>
        <div class="fmt-row">
          <span class="fmt-key">Pkt Size</span>
          <div class="seg-group">
            <button v-for="n in sppOptions" :key="n"
              class="seg-btn seg-btn--sm"
              :class="{ 'seg-btn--on': source.max_samples_per_packet === n }"
              @click="patch({ max_samples_per_packet: n })"
            >{{ n }}<span class="spp-ms"> {{ sppMs(n) }}</span></button>
          </div>
        </div>
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
.panel-title { font-size: 14px; font-weight: 700; color: #37474f; }

.st-section-label {
  display: flex; align-items: center; gap: 8px;
  font-size: 11px; font-weight: 700; color: #90a4ae;
  letter-spacing: 0.8px; text-transform: uppercase;
  padding: 10px 18px 5px;
}
.st-strip { padding: 8px 18px 12px; }

.stat-row  { display: flex; gap: 24px; flex-wrap: wrap; }
.stat-item { display: flex; flex-direction: column; gap: 2px; }
.stat-key  { font-size: 10px; font-weight: 700; color: #90a4ae; letter-spacing: 0.5px; text-transform: uppercase; }
.stat-val  { font-size: 13px; font-weight: 600; color: #546e7a; }
.stat-active { color: #1565c0; }
.font-mono { font-family: 'Courier New', monospace; }

.fmt-section { display: flex; flex-direction: column; gap: 12px; }
.fmt-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.fmt-key { font-size: 11px; font-weight: 700; color: #90a4ae; width: 62px; flex-shrink: 0; }

.seg-group { display: flex; gap: 5px; flex-wrap: wrap; }
.seg-btn {
  background: #f5f5f5; border: 1px solid #cfd8dc; border-radius: 3px;
  padding: 6px 12px; font-size: 12px; font-weight: 600; color: #546e7a;
  cursor: pointer; transition: background 0.1s, color 0.1s;
}
.seg-btn--sm { padding: 5px 9px; font-size: 11px; }
.seg-btn:hover { background: #e3f2fd; border-color: #90caf9; }
.seg-btn--on   { background: #1565c0; border-color: #1565c0; color: #fff; }
.spp-ms { font-size: 9px; font-weight: 400; opacity: 0.8; }

.dialog-head   { padding: 14px 20px; }
.dialog-title  { font-size: 15px; font-weight: 700; color: #37474f; }
.sdp-text {
  font-family: 'Courier New', monospace; font-size: 11px; color: #546e7a;
  white-space: pre-wrap; word-break: break-all; margin: 0;
  background: #f5f7f9; padding: 12px; border-radius: 4px;
}
</style>
