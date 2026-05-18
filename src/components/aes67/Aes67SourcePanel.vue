<script setup>
import { ref, computed } from 'vue'
import { socket } from 'src/boot/socket'
import { useAoipStore } from 'src/stores/aoip'
import LevelMeter from 'src/components/mixer/LevelMeter.vue'

const props = defineProps({
  source: { type: Object, required: true },
})

const emit = defineEmits(['refresh'])

const aoipState = useAoipStore()

const busy    = ref(false)
const showSdp = ref(false)
const sdpText = ref('')

const showEdit  = ref(false)
const editBusy  = ref(false)
const editError = ref('')
const editForm  = ref({})

const codecOptions = ['L16', 'L24', 'AM824']
const sppOptions   = [12, 24, 48, 96, 192]

const meterChannels = computed(() => {
  const aes67Chs = aoipState.channels.outputs
    .filter((ch) => ch.label.toLowerCase().includes('aes67'))
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
  editForm.value = {
    name:                   props.source.name,
    address:                props.source.address,
    codec:                  props.source.codec,
    max_samples_per_packet: props.source.max_samples_per_packet,
    channels:               props.source.map?.length ?? 2,
    chStart:                props.source.map?.[0] ?? 0,
    ttl:                    props.source.ttl ?? 15,
  }
  editError.value = ''
  showEdit.value = true
}

function confirmEdit() {
  const f = editForm.value
  if (!f.name.trim()) { editError.value = '이름을 입력하세요'; return }
  if (!f.address.trim()) { editError.value = '주소를 입력하세요'; return }

  const map = Array.from({ length: f.channels }, (_, i) => f.chStart + i)
  const others = aoipState.aes67Sources.filter((s) => s.id !== props.source.id)

  const addrConflict = others.find((s) => s.address === f.address.trim())
  if (addrConflict) {
    editError.value = `주소 ${f.address.trim()}는 "${addrConflict.name}"에서 이미 사용 중입니다`
    return
  }
  const mapSet = new Set(map)
  const chConflict = others.find((s) => (s.map ?? []).some((ch) => mapSet.has(ch)))
  if (chConflict) {
    const used = chConflict.map.filter((ch) => mapSet.has(ch)).map((ch) => `Ch ${ch + 1}`).join(', ')
    editError.value = `채널이 "${chConflict.name}"과 겹칩니다 (${used})`
    return
  }

  editBusy.value = true
  editError.value = ''
  const { id } = props.source
  socket.emit('aes67:source:add', {
    ...props.source,
    id,
    name:                   f.name.trim(),
    address:                f.address.trim(),
    codec:                  f.codec,
    max_samples_per_packet: f.max_samples_per_packet,
    ttl:                    f.ttl,
    map,
  }, (res) => {
    editBusy.value = false
    if (res?.ok) showEdit.value = false
    else editError.value = res?.error ?? 'Failed'
  })
}

function remove() {
  if (!confirm(`"${props.source.name}" 소스를 삭제하시겠습니까?`)) return
  socket.emit('aes67:source:remove', { id: props.source.id }, () => emit('refresh'))
}

function viewSdp() {
  socket.emit('aes67:source:sdp', { id: props.source.id }, (res) => {
    sdpText.value = res?.ok
      ? (typeof res.sdp === 'string' ? res.sdp : JSON.stringify(res.sdp, null, 2))
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
          <q-icon name="upload" size="md" color="blue-7" />
          <span class="item-title">{{ source.name }}</span>
          <q-badge outline :color="source.enabled ? 'positive' : 'grey-5'">
            {{ source.enabled ? 'ON' : 'OFF' }}
          </q-badge>
        </div>
        <div class="row items-center">
          <q-btn flat round size="md" icon="data_object" color="grey-6" @click="viewSdp">
            <q-tooltip>SDP 보기</q-tooltip>
          </q-btn>
          <q-btn flat round size="md" icon="edit" color="grey-6" @click="openEdit">
            <q-tooltip>수정</q-tooltip>
          </q-btn>
          <q-btn flat round size="md"
            :icon="source.enabled ? 'pause_circle' : 'play_circle'"
            :color="source.enabled ? 'orange-7' : 'positive'"
            :loading="busy"
            @click="patch({ enabled: !source.enabled })">
            <q-tooltip>{{ source.enabled ? 'Disable' : 'Enable' }}</q-tooltip>
          </q-btn>
          <q-btn flat round size="md" icon="delete_outline" color="negative" @click="remove">
            <q-tooltip>삭제</q-tooltip>
          </q-btn>
          <LevelMeter v-if="meterChannels.length" :channels="meterChannels" :title="source.name" />
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
          <span class="cs-val">{{ source.max_samples_per_packet }}<span class="cs-sub"> ({{ sppMs(source.max_samples_per_packet) }})</span></span>
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

  <!-- Edit dialog -->
  <q-dialog v-model="showEdit" persistent>
    <q-card style="min-width: 400px">
      <q-card-section class="dialog-head">
        <span class="dialog-title">Edit Source</span>
      </q-card-section>
      <q-separator />
      <q-card-section class="dialog-body">
        <div class="field-group">
          <label class="field-label">이름</label>
          <q-input v-model="editForm.name" dense outlined autofocus />
        </div>
        <div class="field-group">
          <label class="field-label">Multicast Address</label>
          <q-input v-model="editForm.address" dense outlined class="font-mono" />
        </div>
        <div class="field-group">
          <label class="field-label">Codec</label>
          <div class="seg-group">
            <button v-for="c in codecOptions" :key="c"
              class="seg-btn" :class="{ 'seg-btn--on': editForm.codec === c }"
              @click="editForm.codec = c">{{ c }}</button>
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">Samples / Packet (Ptime)</label>
          <div class="seg-group">
            <button v-for="n in sppOptions" :key="n"
              class="seg-btn seg-btn--sm"
              :class="{ 'seg-btn--on': editForm.max_samples_per_packet === n }"
              @click="editForm.max_samples_per_packet = n">{{ n }}</button>
          </div>
        </div>
        <div class="dlg-row">
          <div class="field-group" style="flex:1">
            <label class="field-label">채널 수</label>
            <q-input v-model.number="editForm.channels" dense outlined type="number" :min="1" :max="8" />
          </div>
          <div class="field-group" style="flex:1">
            <label class="field-label">시작 채널</label>
            <q-input v-model.number="editForm.chStart" dense outlined type="number" :min="0" :max="7" />
          </div>
          <div class="field-group" style="flex:1">
            <label class="field-label">TTL</label>
            <q-input v-model.number="editForm.ttl" dense outlined type="number" :min="1" />
          </div>
        </div>
        <p v-if="editError" class="form-error">{{ editError }}</p>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right" class="dialog-actions">
        <q-btn flat label="취소" color="grey-7" v-close-popup />
        <q-btn unelevated label="저장" color="blue-7" :loading="editBusy" @click="confirmEdit" />
      </q-card-actions>
    </q-card>
  </q-dialog>

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
.cs-item  { display: flex; gap: 4px; align-items: center; white-space: nowrap; }
.cs-key   { font-size: 11px; font-weight: 700; color: #90a4ae; letter-spacing: 0.4px; }
.cs-val   { font-size: 12px; font-weight: 500; color: #37474f; font-variant-numeric: tabular-nums; }
.cs-mono  { font-family: 'Courier New', monospace; color: #1565c0; }
.cs-sub   { font-size: 10px; color: #90a4ae; }
.cs-w-addr { min-width: 130px; }

/* ── Dialog ── */
.dialog-head   { padding: 14px 20px; }
.dialog-title  { font-size: 15px; font-weight: 700; color: #37474f; }
.dialog-body   { display: flex; flex-direction: column; gap: 14px; padding: 16px 20px; }
.dialog-actions { padding: 8px 16px 12px; }
.dlg-row { display: flex; gap: 10px; align-items: flex-end; }
.field-group { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 11px; font-weight: 700; color: #90a4ae; letter-spacing: 0.5px; text-transform: uppercase; }
.form-error  { margin: 0; font-size: 12px; color: #c62828; font-weight: 600; }
.font-mono   { font-family: 'Courier New', monospace; }

.seg-group { display: flex; gap: 5px; flex-wrap: wrap; }
.seg-btn {
  background: #f5f5f5; border: 1px solid #cfd8dc; border-radius: 3px;
  padding: 6px 13px; font-size: 13px; font-weight: 600; color: #546e7a;
  cursor: pointer; transition: background 0.1s, color 0.1s;
}
.seg-btn--sm { padding: 5px 10px; font-size: 12px; }
.seg-btn:hover { background: #e3f2fd; border-color: #90caf9; }
.seg-btn--on   { background: #1565c0; border-color: #1565c0; color: #fff; }

.sdp-text {
  font-family: 'Courier New', monospace; font-size: 11px; color: #546e7a;
  white-space: pre-wrap; word-break: break-all; margin: 0;
  background: #f5f7f9; padding: 12px; border-radius: 4px;
}
</style>
