<script setup>
import { ref, computed } from 'vue'
import { useDialogPluginComponent } from 'quasar'
import { socket } from 'src/boot/socket'
import { useAoipStore } from 'src/stores/aoip'

defineEmits([...useDialogPluginComponent.emits])
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent()

const aoipState = useAoipStore()
const sinks = computed(() => aoipState.aes67Sinks)
const nextId = computed(() =>
  sinks.value.length ? Math.max(...sinks.value.map((s) => s.id)) + 1 : 0,
)

function usedSlots() {
  const used = new Set()
  for (const s of sinks.value)
    for (const idx of (s.map ?? [])) used.add(idx)
  return used
}
function chSlotOptions(unit) {
  const used = usedSlots()
  return Array.from({ length: Math.floor(16 / unit) }, (_, i) => {
    const start = i * unit
    const inUse = Array.from({ length: unit }, (_, j) => start + j).some((idx) => used.has(idx))
    return { label: `Ch ${start + 1}–${start + unit}`, value: start, disable: inUse }
  })
}
function firstAvailableSlot(unit) {
  const used = usedSlots()
  for (let i = 0; i < 16; i += unit)
    if (!Array.from({ length: unit }, (_, j) => i + j).some((idx) => used.has(idx))) return i
  return 0
}

const busy = ref(false)
const error = ref('')
const tab = ref('browse')
const browseList = ref([])
const browseBusy = ref(false)
const selectedRemote = ref(null)

const chUnitOptions = [{ label: '2ch', value: 2 }, { label: '8ch', value: 8 }]
const delayOptions = [
  { label: '192 – 4ms@48kHz', value: 192 },
  { label: '384 – 8ms@48kHz', value: 384 },
  { label: '576 – 12ms@48kHz', value: 576 },
  { label: '768 – 16ms@48kHz', value: 768 },
  { label: '960 – 20ms@48kHz', value: 960 },
]
const form = ref({ name: '', url: '', rawSdp: '', delay: 192, ignoreRefclk: true, chUnit: 2, chStart: firstAvailableSlot(2) })

function doBrowse() {
  browseBusy.value = true
  socket.emit('aes67:browse', { type: 'all' }, (res) => {
    const raw = res?.sources
    browseList.value = Array.isArray(raw) ? raw : (raw?.remote_sources ?? [])
    browseBusy.value = false
  })
}
doBrowse()

function selectRemote(src) {
  selectedRemote.value = src
  if (!form.value.name) form.value.name = src.name
  const m = (src.sdp ?? '').match(/a=rtpmap:\d+\s+\S+\/\d+\/(\d+)/)
  if (m) {
    const unit = Number(m[1]) >= 8 ? 8 : 2
    form.value.chUnit = unit
    form.value.chStart = firstAvailableSlot(unit)
  }
}
function sdpAddress(sdp) { const m = (sdp ?? '').match(/c=IN IP4 ([^\s/]+)/); return m ? m[1] : null }
function sdpCodec(sdp) {
  const m = (sdp ?? '').match(/a=rtpmap:\d+\s+([^/\s]+)\/(\d+)(?:\/(\d+))?/)
  return m ? `${m[1]} ${(Number(m[2]) / 1000).toFixed(0)}kHz ${m[3] ?? 1}ch` : ''
}

function confirm() {
  const f = form.value
  if (!f.name.trim()) { error.value = '이름을 입력하세요'; return }
  if (tab.value === 'browse' && !selectedRemote.value) { error.value = '소스를 선택하세요'; return }
  if ((tab.value === 'url' || tab.value === 'sdp') && !f.url.trim() && !f.rawSdp.trim()) {
    error.value = 'URL 또는 SDP를 입력하세요'; return
  }
  const map = Array.from({ length: f.chUnit }, (_, i) => f.chStart + i)
  const mapSet = new Set(map)
  const conflict = sinks.value.find((s) => (s.map ?? []).some((ch) => mapSet.has(ch)))
  if (conflict) {
    error.value = `채널이 "${conflict.name}"과 겹칩니다 (${conflict.map.filter((ch) => mapSet.has(ch)).map((ch) => `Ch ${ch + 1}`).join(', ')})`
    return
  }
  busy.value = true
  error.value = ''
  const base = { name: f.name.trim(), io: 'Audio Device', delay: f.delay, ignore_refclk_gmid: f.ignoreRefclk, map }
  const body = tab.value === 'browse'
    ? { ...base, use_sdp: true, source: 'http://127.0.0.1/', sdp: selectedRemote.value.sdp }
    : f.url.trim()
      ? { ...base, use_sdp: false, source: f.url.trim() }
      : { ...base, use_sdp: true, source: 'http://127.0.0.1/', sdp: f.rawSdp.trim() }
  socket.emit('aes67:sink:add', { id: nextId.value, ...body }, (res) => {
    busy.value = false
    if (res?.ok) onDialogOK()
    else error.value = res?.error ?? 'Failed'
  })
}
</script>

<template>
  <q-dialog ref="dialogRef" persistent @hide="onDialogHide">
    <q-card style="min-width: 460px; max-width: 95vw">
      <q-card-section class="dialog-head">
        <span class="dialog-title">Add AES67 Sink (입력)</span>
      </q-card-section>
      <q-separator />
      <q-tabs v-model="tab" dense align="left" class="q-px-md q-pt-sm" active-color="primary" indicator-color="primary">
        <q-tab name="browse" label="네트워크 탐색" icon="wifi_find" />
        <q-tab name="url" label="URL" icon="link" />
        <q-tab name="sdp" label="SDP 직접 입력" icon="code" />
      </q-tabs>
      <q-separator />
      <q-card-section class="dialog-body">
        <q-tab-panels v-model="tab" animated>
          <q-tab-panel name="browse" class="q-pa-none">
            <div class="browse-toolbar">
              <span class="browse-count">{{ browseList.length }}개 발견</span>
              <q-btn flat dense round size="sm" icon="refresh" color="grey-6" :loading="browseBusy" @click="doBrowse" />
            </div>
            <div v-if="browseBusy" class="browse-loading"><q-spinner size="24px" color="primary" /></div>
            <div v-else-if="!browseList.length" class="browse-empty">네트워크에서 AES67 소스를 찾을 수 없습니다</div>
            <div v-else class="browse-list">
              <div v-for="src in browseList" :key="src.id" class="browse-card"
                :class="{ 'browse-card--sel': selectedRemote?.id === src.id }" @click="selectRemote(src)">
                <div class="browse-card-name">{{ src.name }}</div>
                <div class="browse-card-meta">
                  <span class="meta-chip">{{ src.source }}</span>
                  <span v-if="sdpAddress(src.sdp)" class="meta-chip mono">{{ sdpAddress(src.sdp) }}</span>
                  <span v-if="sdpCodec(src.sdp)" class="meta-chip">{{ sdpCodec(src.sdp) }}</span>
                </div>
              </div>
            </div>
          </q-tab-panel>
          <q-tab-panel name="url" class="q-pa-none">
            <div class="field-group q-pt-sm">
              <label class="field-label">SDP URL</label>
              <q-input v-model="form.url" dense outlined placeholder="http://192.168.0.x:8080/api/source/sdp/0" class="font-mono" />
            </div>
          </q-tab-panel>
          <q-tab-panel name="sdp" class="q-pa-none">
            <div class="field-group q-pt-sm">
              <label class="field-label">SDP 내용</label>
              <q-input v-model="form.rawSdp" dense outlined type="textarea" :rows="6" placeholder="v=0&#10;o=- ..." class="font-mono" />
            </div>
          </q-tab-panel>
        </q-tab-panels>
        <q-separator class="q-my-sm" />
        <div class="field-group">
          <label class="field-label">이름</label>
          <q-input v-model="form.name" dense outlined placeholder="Sink 이름" />
        </div>
        <div class="dlg-row">
          <div class="field-group" style="flex:1">
            <label class="field-label">Delay (samples)</label>
            <q-select v-model="form.delay" :options="delayOptions" emit-value map-options dense outlined />
          </div>
          <div class="field-group" style="flex:1">
            <label class="field-label">채널 단위</label>
            <q-select v-model="form.chUnit" :options="chUnitOptions" emit-value map-options dense outlined
              @update:model-value="(val) => { form.chStart = firstAvailableSlot(val) }" />
          </div>
          <div class="field-group" style="flex:2">
            <label class="field-label">채널 슬롯</label>
            <q-select v-model="form.chStart" :options="chSlotOptions(form.chUnit)"
              emit-value map-options dense outlined option-disable="disable" />
          </div>
        </div>
        <q-toggle v-model="form.ignoreRefclk" label="GM ID 무시 (Ignore refclk GMID)" color="primary" dense />
        <p v-if="error" class="form-error">{{ error }}</p>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right" class="dialog-actions">
        <q-btn flat label="취소" color="grey-7" v-close-popup />
        <q-btn unelevated label="추가" color="green-7" :loading="busy" @click="confirm" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.dialog-head { padding: 14px 20px; }
.dialog-title { font-size: 15px; font-weight: 700; color: #37474f; }
.dialog-body { display: flex; flex-direction: column; gap: 14px; padding: 16px 20px; }
.dialog-actions { padding: 8px 16px 12px; }
.dlg-row { display: flex; gap: 10px; align-items: flex-end; }
.field-group { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 11px; font-weight: 700; color: #90a4ae; letter-spacing: 0.5px; text-transform: uppercase; }
.form-error { margin: 0; font-size: 12px; color: #c62828; font-weight: 600; }
.font-mono { font-family: 'Courier New', monospace; }
.browse-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 4px 0 8px; font-size: 12px; color: #90a4ae; }
.browse-count { font-weight: 600; }
.browse-loading, .browse-empty { display: flex; justify-content: center; align-items: center; padding: 24px; color: #b0bec5; font-size: 13px; }
.browse-list { display: flex; flex-direction: column; gap: 6px; max-height: 240px; overflow-y: auto; }
.browse-card { border: 1px solid #e0e0e0; border-radius: 4px; padding: 10px 12px; cursor: pointer; transition: background 0.1s, border-color 0.1s; }
.browse-card:hover { background: #f5f9ff; border-color: #90caf9; }
.browse-card--sel { background: #e3f2fd; border-color: #1565c0; }
.browse-card-name { font-size: 13px; font-weight: 700; color: #37474f; margin-bottom: 4px; }
.browse-card-meta { display: flex; gap: 5px; flex-wrap: wrap; }
.meta-chip { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 3px; background: #f5f5f5; color: #546e7a; border: 1px solid #e0e0e0; }
.mono { font-family: 'Courier New', monospace; }
</style>
