<script setup>
import { ref, computed } from 'vue'
import { api } from 'src/boot/axios'

const props = defineProps({
  s:      { type: Object, required: true },
  detail: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['refresh'])

// ── Stream Format (stream-level single setting) ──────────
const bitrateOptions = {
  mp3:  [128, 160, 192, 224, 256, 320],
  opus: [64,  96,  128, 192, 256, 320],
}

const curCodec    = computed(() => props.detail?.codec    ?? 'mp3')
const curBitrate  = computed(() => props.detail?.bitrate  ?? 320)
const curProtocol = computed(() => props.detail?.protocol ?? 'rtp')

const formatBusy = ref(false)

async function setCodec(codec) {
  if (formatBusy.value || codec === curCodec.value) return
  formatBusy.value = true
  const opts    = bitrateOptions[codec] ?? []
  const bitrate = codec !== 'raw'
    ? (opts.includes(curBitrate.value) ? curBitrate.value : opts.at(-1))
    : undefined
  try {
    await api.put(`/streams/rtp/${props.s.client}/codec`, { codec, bitrate })
    emit('refresh')
  } finally { formatBusy.value = false }
}

async function setBitrate(br) {
  if (formatBusy.value || br === curBitrate.value) return
  formatBusy.value = true
  try {
    await api.put(`/streams/rtp/${props.s.client}/codec`, { codec: curCodec.value, bitrate: br })
    emit('refresh')
  } finally { formatBusy.value = false }
}

async function setProtocol(proto) {
  if (formatBusy.value || proto === curProtocol.value) return
  formatBusy.value = true
  try {
    await api.put(`/streams/rtp/${props.s.client}/config`, { protocol: proto })
    emit('refresh')
  } finally { formatBusy.value = false }
}

// ── Add Target dialog ────────────────────────────────────
const showDialog = ref(false)
const newHost    = ref('')
const newPort    = ref('')
const addBusy    = ref(false)
const addError   = ref('')

function openDialog() {
  newHost.value    = ''
  newPort.value    = ''
  addError.value   = ''
  showDialog.value = true
}

async function confirmAdd() {
  const host = newHost.value.trim()
  const port = Number(newPort.value)
  if (!host || !port) { addError.value = 'Host와 Port를 입력하세요'; return }
  addBusy.value  = true
  addError.value = ''
  try {
    const res = await api.post(`/streams/rtp/${props.s.client}/targets`, { host, port })
    if (!res.data?.ok) { addError.value = 'Failed'; addBusy.value = false; return }
    showDialog.value = false
    emit('refresh')
  } catch { addError.value = 'Failed' }
  addBusy.value = false
}

async function removeTarget(host, port) {
  try {
    const res = await api.delete(`/streams/rtp/${props.s.client}/targets`, { data: { host, port } })
    if (res.data?.ok) emit('refresh')
  } catch { /* ignore */ }
}

// ── Live stats ───────────────────────────────────────────
const liveKbps      = computed(() => props.s?.stats?.bitrateKbps ?? 0)
const liveBytesSent = computed(() => props.s?.stats?.bytesSent   ?? 0)

function fmtBytes(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' GB'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' MB'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + ' KB'
  return n + ' B'
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

  <!-- Format & Protocol (single stream setting) -->
  <div class="st-section-label">Format</div>
  <div class="st-strip fmt-section">

    <!-- Protocol -->
    <div class="fmt-row">
      <span class="fmt-key">Protocol</span>
      <div class="seg-group">
        <button class="seg-btn" :class="{ 'seg-btn--on': curProtocol === 'rtp' }"
          @click="setProtocol('rtp')">RTP</button>
        <button class="seg-btn" :class="{ 'seg-btn--on': curProtocol === 'raw' }"
          @click="setProtocol('raw')">UDP Raw</button>
      </div>
      <span v-if="s.running" class="restart-note">재시작 후 적용</span>
    </div>

    <!-- Codec -->
    <div class="fmt-row">
      <span class="fmt-key">Codec</span>
      <div class="seg-group">
        <button class="seg-btn" :class="{ 'seg-btn--on': curCodec === 'mp3' }"
          @click="setCodec('mp3')">MP3</button>
        <button class="seg-btn" :class="{ 'seg-btn--on': curCodec === 'opus' }"
          @click="setCodec('opus')">Opus</button>
        <button class="seg-btn" :class="{ 'seg-btn--on': curCodec === 'raw' }"
          @click="setCodec('raw')">RAW PCM</button>
      </div>
    </div>

    <!-- Bitrate (shown only when codec != raw) -->
    <transition name="fade">
      <div v-if="curCodec !== 'raw'" class="fmt-row">
        <span class="fmt-key">Bitrate</span>
        <div class="seg-group">
          <button
            v-for="br in (bitrateOptions[curCodec] ?? [])" :key="br"
            class="seg-btn seg-btn--sm"
            :class="{ 'seg-btn--on': curBitrate === br }"
            @click="setBitrate(br)"
          >{{ br }}k</button>
        </div>
      </div>
    </transition>

  </div>

  <q-separator />

  <!-- UDP Targets -->
  <div class="st-section-label">
    UDP Targets
    <q-btn flat dense round size="xs" icon="add" color="blue-7" class="add-btn" @click="openDialog">
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

  <!-- Add Target dialog -->
  <q-dialog v-model="showDialog" persistent>
    <q-card style="min-width: 320px">
      <q-card-section class="dialog-head">
        <span class="dialog-title">Add UDP Target</span>
      </q-card-section>
      <q-separator />
      <q-card-section class="dialog-body">
        <div class="dlg-row">
          <div class="field-group" style="flex:1">
            <label class="field-label">Host / IP</label>
            <q-input
              v-model="newHost" dense outlined
              placeholder="192.168.0.100"
              autofocus @keydown.enter="confirmAdd"
            />
          </div>
          <div class="field-group" style="width:110px">
            <label class="field-label">Port</label>
            <q-input
              v-model="newPort" dense outlined
              placeholder="5004" type="number"
              @keydown.enter="confirmAdd"
            />
          </div>
        </div>
        <p v-if="addError" class="add-error">{{ addError }}</p>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right" class="dialog-actions">
        <q-btn flat label="Cancel" color="grey-7" v-close-popup />
        <q-btn
          unelevated label="Add" color="blue-7"
          :loading="addBusy"
          :disable="!newHost || !newPort"
          @click="confirmAdd"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
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

/* ── Format section ── */
.fmt-section { display: flex; flex-direction: column; gap: 12px; }
.fmt-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.fmt-key {
  font-size: 11px; font-weight: 700; color: #90a4ae;
  letter-spacing: 0.5px; width: 62px; flex-shrink: 0;
}
.restart-note {
  font-size: 10px; color: #fb8c00; font-weight: 600; white-space: nowrap;
}

/* ── Seg buttons ── */
.seg-group { display: flex; gap: 5px; flex-wrap: wrap; }
.seg-btn {
  background: #f5f5f5;
  border: 1px solid #cfd8dc;
  border-radius: 3px;
  padding: 6px 14px;
  font-size: 13px; font-weight: 600; color: #546e7a;
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s, color 0.1s;
}
.seg-btn--sm  { padding: 5px 9px; font-size: 12px; }
.seg-btn:hover { background: #e3f2fd; border-color: #90caf9; }
.seg-btn--on   { background: #1565c0; border-color: #1565c0; color: #fff; }

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

/* ── Dialog ── */
.dialog-head    { padding: 14px 20px; }
.dialog-title   { font-size: 15px; font-weight: 700; color: #37474f; }
.dialog-body    { display: flex; flex-direction: column; gap: 14px; padding: 16px 20px; }
.dialog-actions { padding: 8px 16px 12px; }
.dlg-row        { display: flex; gap: 10px; align-items: flex-end; }
.field-group    { display: flex; flex-direction: column; gap: 6px; }
.field-label {
  font-size: 11px; font-weight: 700;
  color: #90a4ae; letter-spacing: 0.5px; text-transform: uppercase;
}
.add-error { margin: 0; font-size: 12px; color: #c62828; font-weight: 600; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from,   .fade-leave-to     { opacity: 0; }
</style>
