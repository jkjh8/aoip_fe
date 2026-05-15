<script setup>
import { computed } from 'vue'
import { socket } from 'src/boot/socket'
import { useQuasar } from 'quasar'
import AddTargetDialog from './AddTargetDialog.vue'

const props = defineProps({
  s:      { type: Object, required: true },
  detail: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['refresh'])

const $q = useQuasar()

// ── Live stats ───────────────────────────────────────────
const liveKbps      = computed(() => props.s?.stats?.bitrateKbps ?? 0)
const liveBytesSent = computed(() => props.s?.stats?.bytesSent   ?? 0)

function fmtBytes(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' GB'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' MB'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + ' KB'
  return n + ' B'
}

// ── Format display ───────────────────────────────────────
const curCodec    = computed(() => props.detail?.codec    ?? '—')
const curBitrate  = computed(() => props.detail?.bitrate  ?? null)
const curProtocol = computed(() => props.detail?.protocol ?? '—')

const formatLabel = computed(() => {
  const parts = [curCodec.value.toUpperCase()]
  if (curCodec.value !== 'raw' && curBitrate.value) parts.push(`${curBitrate.value} kbps`)
  return parts.join(' · ')
})

// ── Add Target dialog ────────────────────────────────────
function openAddTarget() {
  $q.dialog({ component: AddTargetDialog })
    .onOk(({ host, port }) => {
      socket.emit('rtp:out:target:add', { client: props.s.client, host, port }, (res) => {
        if (res?.ok) emit('refresh', props.s.client)
      })
    })
}

function removeTarget(host, port) {
  socket.emit('rtp:out:target:remove', { client: props.s.client, host, port }, (res) => {
    if (res?.ok) emit('refresh', props.s.client)
  })
}
</script>

<template>
  <!-- Live stats -->
  <div class="st-section-label">Send Stream</div>
  <div class="st-strip stat-row">
    <div class="stat-item">
      <span class="stat-key">Bitrate</span>
      <span class="stat-val" :class="liveKbps > 0 ? 'stat-active' : 'stat-muted'">
        {{ liveKbps > 0 ? liveKbps + ' kbps' : '—' }}
      </span>
    </div>
    <div class="stat-item">
      <span class="stat-key">Sent</span>
      <span class="stat-val" :class="liveBytesSent > 0 ? 'stat-active' : 'stat-muted'">
        {{ liveBytesSent > 0 ? fmtBytes(liveBytesSent) : '—' }}
      </span>
    </div>
  </div>

  <q-separator />

  <!-- Format info (text) -->
  <div class="st-section-label">Format</div>
  <div class="st-strip info-grid">
    <div class="info-row">
      <span class="info-key">Protocol</span>
      <span class="info-val">{{ curProtocol.toUpperCase() }}</span>
    </div>
    <div class="info-row">
      <span class="info-key">Codec</span>
      <span class="info-val">{{ formatLabel }}</span>
    </div>
  </div>

  <q-separator />

  <!-- UDP Targets -->
  <div class="st-section-label">
    UDP Targets
    <q-btn flat dense round size="xs" icon="add" color="blue-7" class="add-btn" @click="openAddTarget">
      <q-tooltip class="bg-grey-4 text-grey-9" anchor="top middle" self="bottom middle" :offset="[0,4]">
        Add Target
      </q-tooltip>
    </q-btn>
  </div>
  <div class="st-strip">
    <div class="target-list">
      <div
        v-for="t in (detail?.targets ?? [])"
        :key="`${t.host}:${t.port}`"
        class="target-card"
      >
        <q-icon name="wifi_tethering" size="13px" color="blue-7" />
        <span class="target-addr">{{ t.host }}</span>
        <span class="target-colon">:</span>
        <span class="target-port">{{ t.port }}</span>
        <button class="target-remove" @click="removeTarget(t.host, t.port)">
          <q-icon name="close" size="11px" />
        </button>
      </div>
      <span v-if="!detail?.targets?.length" class="empty-hint">None</span>
    </div>
  </div>
</template>

<style scoped>
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
.add-btn { margin-left: auto; }

.st-strip {
  padding: 8px 18px 12px;
}

/* ── Stats ── */
.stat-row  { display: flex; gap: 24px; }
.stat-item { display: flex; flex-direction: column; gap: 2px; }
.stat-key  { font-size: 10px; font-weight: 700; color: #90a4ae; letter-spacing: 0.5px; text-transform: uppercase; }
.stat-val  { font-size: 14px; font-weight: 600; }
.stat-active { color: #1565c0; }
.stat-muted  { color: #b0bec5; }

/* ── Info grid (format display) ── */
.info-grid { display: flex; flex-direction: column; gap: 6px; }
.info-row  { display: flex; align-items: center; font-size: 13px; }
.info-key  {
  font-size: 11px; font-weight: 700; color: #90a4ae;
  letter-spacing: 0.5px; width: 70px; flex-shrink: 0;
}
.info-val  { color: #37474f; font-weight: 500; }

/* ── Target list ── */
.target-list { display: flex; flex-direction: column; gap: 5px; min-height: 28px; }
.target-card {
  display: flex;
  align-items: center;
  gap: 5px;
  background: #f5f9ff;
  border: 1px solid #90caf9;
  border-radius: 4px;
  padding: 7px 10px;
}
.target-addr  { font-weight: 600; color: #1565c0; font-size: 13px; }
.target-colon { color: #90a4ae; font-size: 13px; }
.target-port  { font-weight: 700; color: #1565c0; font-size: 13px; font-family: 'Courier New', monospace; }
.target-remove {
  background: none; border: none; cursor: pointer;
  padding: 0 0 0 4px; color: #b0bec5;
  display: flex; align-items: center; margin-left: auto;
}
.target-remove:hover { color: #e53935; }
.empty-hint { font-size: 13px; color: #cfd8dc; }
</style>
