<script setup>
import { ref, computed } from 'vue'
import { api } from 'src/boot/axios'

const props = defineProps({
  s:      { type: Object, required: true },
  detail: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['refresh'])

// ── Add Target 팝업 ───────────────────────────────────
const showDialog = ref(false)
const newHost    = ref('')
const newPort    = ref('')
const addBusy    = ref(false)
const addError   = ref('')

// 코덱 설정 (팝업 내)
const bitrateOptions = {
  mp3:  [128, 160, 192, 224, 256, 320],
  opus: [64,  96,  128, 192, 256, 320],
}
const dlgCodec   = ref(null)
const dlgBitrate = ref(null)
const dlgProto   = ref(null)

const activeCodec   = () => dlgCodec.value   ?? props.detail?.codec    ?? 'mp3'
const activeBitrate = () => dlgBitrate.value ?? props.detail?.bitrate  ?? 320
const activeProto   = () => dlgProto.value   ?? props.detail?.protocol ?? 'rtp'

function setDlgCodec(c) {
  dlgCodec.value = c
  if (c === 'raw') dlgBitrate.value = null
}

function openDialog() {
  newHost.value  = ''
  newPort.value  = ''
  addError.value = ''
  dlgCodec.value   = null
  dlgBitrate.value = null
  dlgProto.value   = null
  showDialog.value = true
}

async function confirmAdd() {
  const host = newHost.value.trim()
  const port = Number(newPort.value)
  if (!host || !port) { addError.value = 'Host와 Port를 입력하세요'; return }
  addBusy.value = true
  addError.value = ''
  try {
    // 타겟 추가
    const tRes = await api.post(`/streams/rtp/${props.s.client}/targets`, { host, port })
    if (!tRes.data?.ok) { addError.value = 'Failed'; addBusy.value = false; return }

    // 코덱/프로토콜이 변경된 경우에만 PUT
    const codec   = activeCodec()
    const bitrate = codec !== 'raw' ? activeBitrate() : undefined
    if (dlgCodec.value || dlgBitrate.value) {
      await api.put(`/streams/rtp/${props.s.client}/codec`, { codec, bitrate })
    }

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

// ── 타겟 표시용 포맷 정보 ──────────────────────────────
const protocolLabel = computed(() => (props.detail?.protocol ?? 'rtp').toUpperCase())
const formatLabel   = computed(() => {
  const codec   = props.detail?.codec
  const bitrate = props.detail?.bitrate
  if (!codec) return '—'
  if (codec === 'raw') return 'RAW PCM'
  return `${codec.toUpperCase()} ${bitrate ?? ''}k`.trim()
})


</script>

<template>
  <!-- UDP Targets -->
  <div class="st-section-label">
    UDP Targets
    <q-btn flat dense round size="xs" icon="add" color="blue-7" class="add-btn" @click="openDialog">
      <q-tooltip class="bg-grey-4 text-grey-9" anchor="top middle" self="bottom middle" :offset="[0,4]">Add Target</q-tooltip>
    </q-btn>
  </div>
  <div class="st-strip">
    <div class="target-list">
      <div
        v-for="t in (detail?.targets ?? [])"
        :key="`${t.host}:${t.port}`"
        class="target-card"
      >
        <div class="target-card-top">
          <q-icon name="wifi_tethering" size="13px" color="blue-7" />
          <span class="target-addr">{{ t.host }}</span>
          <span class="target-colon">:</span>
          <span class="target-port">{{ t.port }}</span>
          <button class="target-remove" @click="removeTarget(t.host, t.port)">
            <q-icon name="close" size="11px" />
          </button>
        </div>
        <div class="target-card-meta">
          <span class="meta-tag meta-tag--proto">{{ protocolLabel }}</span>
          <span class="meta-tag meta-tag--fmt">{{ formatLabel }}</span>
        </div>
      </div>
      <span v-if="!detail?.targets?.length" class="empty-hint">None</span>
    </div>
  </div>

  <!-- Add Target 팝업 -->
  <q-dialog v-model="showDialog" persistent>
    <q-card style="min-width: 340px">
      <q-card-section class="dialog-head">
        <span class="dialog-title">Add UDP Target</span>
      </q-card-section>
      <q-separator />
      <q-card-section class="dialog-body">

        <!-- Host / Port -->
        <div class="dlg-row">
          <div class="field-group" style="flex:1">
            <label class="field-label">Host / IP</label>
            <q-input v-model="newHost" dense outlined placeholder="192.168.0.100" autofocus @keydown.enter="confirmAdd" />
          </div>
          <div class="field-group" style="width:110px">
            <label class="field-label">Port</label>
            <q-input v-model="newPort" dense outlined placeholder="5004" type="number" @keydown.enter="confirmAdd" />
          </div>
        </div>

        <q-separator />

        <!-- Protocol -->
        <div class="field-group">
          <label class="field-label">Protocol</label>
          <div class="seg-group">
            <button class="seg-btn" :class="{ 'seg-btn--on': activeProto() === 'rtp' }"  @click="dlgProto = 'rtp'">RTP</button>
            <button class="seg-btn" :class="{ 'seg-btn--on': activeProto() === 'raw' }"  @click="dlgProto = 'raw'">UDP Raw</button>
          </div>
        </div>

        <!-- Codec -->
        <div class="field-group">
          <label class="field-label">Codec</label>
          <div class="seg-group">
            <button class="seg-btn" :class="{ 'seg-btn--on': activeCodec() === 'mp3' }"  @click="setDlgCodec('mp3')">MP3</button>
            <button class="seg-btn" :class="{ 'seg-btn--on': activeCodec() === 'opus' }" @click="setDlgCodec('opus')">Opus</button>
            <button class="seg-btn" :class="{ 'seg-btn--on': activeCodec() === 'raw' }"  @click="setDlgCodec('raw')">RAW PCM</button>
          </div>
        </div>

        <!-- Bitrate -->
        <transition name="fade">
          <div v-if="activeCodec() !== 'raw'" class="field-group">
            <label class="field-label">Bitrate</label>
            <div class="seg-group">
              <button
                v-for="br in (bitrateOptions[activeCodec()] ?? [])" :key="br"
                class="seg-btn seg-btn--sm"
                :class="{ 'seg-btn--on': activeBitrate() === br }"
                @click="dlgBitrate = br"
              >{{ br }}k</button>
            </div>
          </div>
        </transition>

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

.target-list { display: flex; flex-direction: column; gap: 6px; min-height: 28px; }

.target-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: #f5f9ff;
  border: 1px solid #90caf9;
  border-radius: 4px;
  padding: 7px 10px;
}
.target-card-top {
  display: flex;
  align-items: center;
  gap: 5px;
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

.target-card-meta { display: flex; gap: 5px; }
.meta-tag {
  font-size: 10px; font-weight: 700;
  padding: 1px 6px; border-radius: 3px; letter-spacing: 0.4px;
}
.meta-tag--proto { background: #e3f2fd; color: #1565c0; }
.meta-tag--fmt   { background: #fce4ec; color: #880e4f; }

.empty-hint { font-size: 13px; color: #cfd8dc; }

/* ── Dialog ── */
.dialog-head    { padding: 14px 20px; }
.dialog-title   { font-size: 15px; font-weight: 700; color: #37474f; }
.dialog-body    { display: flex; flex-direction: column; gap: 16px; padding: 16px 20px; }
.dialog-actions { padding: 8px 16px 12px; }

.dlg-row { display: flex; gap: 10px; align-items: flex-end; }

.field-group { display: flex; flex-direction: column; gap: 6px; }
.field-label {
  font-size: 11px; font-weight: 700;
  color: #90a4ae; letter-spacing: 0.5px; text-transform: uppercase;
}

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
.seg-btn--sm  { padding: 5px 10px; font-size: 12px; }
.seg-btn:hover { background: #e3f2fd; border-color: #90caf9; }
.seg-btn--on   { background: #1565c0; border-color: #1565c0; color: #fff; }

.add-error { margin: 0; font-size: 12px; color: #c62828; font-weight: 600; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from,   .fade-leave-to     { opacity: 0; }
</style>
