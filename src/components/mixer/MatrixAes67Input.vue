<script setup>
import { ref, computed, onMounted } from 'vue'
import { socket } from 'src/boot/socket'
import { useAoipStore } from 'src/stores/aoip'
import { useChannelPanel } from 'src/composables/useChannelPanel'
import LevelMeter from 'src/components/mixer/LevelMeter.vue'

const aoipState = useAoipStore()

const {
  doToggleMute,
  dragging, sliderVal, onSliderInput, thumbLeft, fmtSlider, onSliderChange,
  editingId, inputRefs, editingVal, commitEdit, onEditKeydown, toDb, onDbClick,
} = useChannelPanel('input')

const aes67Chs = computed(() =>
  aoipState.channels.inputs.filter((ch) => ch.label.toLowerCase().includes('aes67')),
)

const sinks = computed(() => aoipState.aes67Sinks)

function sinkChannels(sink) {
  return (sink.map ?? []).map((idx) => aes67Chs.value[idx]).filter(Boolean)
}

function g(ch) { return { stereo: false, ch } }

// ── Sink status ───────────────────────────────────────────
const statusMap = ref({})

function fetchStatus(sink) {
  socket.emit('aes67:sink:status', { id: sink.id }, (res) => {
    if (res?.ok) statusMap.value[sink.id] = res.status
  })
}

function refreshSinks() {
  socket.emit('aes67:sinks:list', (res) => {
    if (res?.ok) {
      aoipState.aes67Sinks = res.sinks ?? []
      for (const s of aoipState.aes67Sinks) fetchStatus(s)
    }
  })
}

onMounted(() => {
  if (!aoipState.aes67Sinks.length) refreshSinks()
  else for (const s of aoipState.aes67Sinks) fetchStatus(s)
})

function sinkLocked(sink) {
  const st = statusMap.value[sink.id]
  if (!st) return null
  return st?.is_sink_connected ?? st?.connected ?? null
}

// ── Delete sink ───────────────────────────────────────────
function removeSink(sink) {
  if (!confirm(`"${sink.name}" 싱크를 삭제하시겠습니까?`)) return
  socket.emit('aes67:sink:remove', { id: sink.id }, (res) => {
    if (res?.ok) refreshSinks()
  })
}

// ── Channel slot options (disable used slots) ─────────────
function usedSlots(excludeId = null) {
  const used = new Set()
  for (const s of aoipState.aes67Sinks) {
    if (s.id === excludeId) continue
    for (const idx of (s.map ?? [])) used.add(idx)
  }
  return used
}

function chSlotOptions(unit, excludeId = null) {
  const used = usedSlots(excludeId)
  const slots = []
  for (let i = 0; i < 16; i += unit) {
    const inUse = Array.from({ length: unit }, (_, j) => i + j).some((idx) => used.has(idx))
    slots.push({ label: `Ch ${i + 1}–${i + unit}`, value: i, disable: inUse })
  }
  return slots
}

function firstAvailableSlot(unit, excludeId = null) {
  const used = usedSlots(excludeId)
  for (let i = 0; i < 16; i += unit) {
    const inUse = Array.from({ length: unit }, (_, j) => i + j).some((idx) => used.has(idx))
    if (!inUse) return i
  }
  return 0
}

// ── Add Sink dialog ───────────────────────────────────────
const showAddSink = ref(false)
const sinkBusy = ref(false)
const sinkError = ref('')
const sinkTab = ref('browse')
const browseList = ref([])
const browseBusy = ref(false)
const selectedRemote = ref(null)

const nextSinkId = computed(() =>
  sinks.value.length ? Math.max(...sinks.value.map((s) => s.id)) + 1 : 0,
)

const sinkForm = ref({ name: '', url: '', rawSdp: '', delay: 192, ignoreRefclk: true, chUnit: 2, chStart: 0 })

const chUnitOptions = [{ label: '2ch', value: 2 }, { label: '8ch', value: 8 }]
const delayOptions = [
  { label: '192 – 4ms@48kHz',  value: 192 },
  { label: '384 – 8ms@48kHz',  value: 384 },
  { label: '576 – 12ms@48kHz', value: 576 },
  { label: '768 – 16ms@48kHz', value: 768 },
  { label: '960 – 20ms@48kHz', value: 960 },
]

function openAddSink() {
  const chUnit = 2
  sinkForm.value = { name: '', url: '', rawSdp: '', delay: 192, ignoreRefclk: true, chUnit, chStart: firstAvailableSlot(chUnit) }
  sinkError.value = ''
  selectedRemote.value = null
  sinkTab.value = 'browse'
  showAddSink.value = true
  doBrowse()
}

function doBrowse() {
  browseBusy.value = true
  socket.emit('aes67:browse', { type: 'all' }, (res) => {
    const raw = res?.sources
    browseList.value = Array.isArray(raw) ? raw : (raw?.remote_sources ?? [])
    browseBusy.value = false
  })
}

function selectRemote(src) {
  selectedRemote.value = src
  if (!sinkForm.value.name) sinkForm.value.name = src.name
  const m = (src.sdp ?? '').match(/a=rtpmap:\d+\s+\S+\/\d+\/(\d+)/)
  if (m) {
    const chUnit = Number(m[1]) >= 8 ? 8 : 2
    sinkForm.value.chUnit = chUnit
    sinkForm.value.chStart = firstAvailableSlot(chUnit)
  }
}

function sdpAddress(sdp) { const m = (sdp ?? '').match(/c=IN IP4 ([^\s/]+)/); return m ? m[1] : null }
function sdpCodec(sdp) {
  const m = (sdp ?? '').match(/a=rtpmap:\d+\s+([^/\s]+)\/(\d+)(?:\/(\d+))?/)
  return m ? `${m[1]} ${(Number(m[2]) / 1000).toFixed(0)}kHz ${m[3] ?? 1}ch` : ''
}

function confirmAddSink() {
  const f = sinkForm.value
  if (!f.name.trim()) { sinkError.value = '이름을 입력하세요'; return }
  if (sinkTab.value === 'browse' && !selectedRemote.value) { sinkError.value = '소스를 선택하세요'; return }
  if ((sinkTab.value === 'url' || sinkTab.value === 'sdp') && !f.url.trim() && !f.rawSdp.trim()) {
    sinkError.value = 'URL 또는 SDP를 입력하세요'; return
  }

  const map = Array.from({ length: f.chUnit }, (_, i) => f.chStart + i)
  const mapSet = new Set(map)
  const chConflict = sinks.value.find((s) => (s.map ?? []).some((ch) => mapSet.has(ch)))
  if (chConflict) {
    const used = chConflict.map.filter((ch) => mapSet.has(ch)).map((ch) => `Ch ${ch + 1}`).join(', ')
    sinkError.value = `채널이 "${chConflict.name}"과 겹칩니다 (${used})`
    return
  }

  sinkBusy.value = true
  sinkError.value = ''

  let body
  if (sinkTab.value === 'browse') {
    body = { name: f.name.trim(), io: 'Audio Device', use_sdp: true, source: 'http://127.0.0.1/', sdp: selectedRemote.value.sdp, delay: f.delay, ignore_refclk_gmid: f.ignoreRefclk, map }
  } else if (f.url.trim()) {
    body = { name: f.name.trim(), io: 'Audio Device', use_sdp: false, source: f.url.trim(), delay: f.delay, ignore_refclk_gmid: f.ignoreRefclk, map }
  } else {
    body = { name: f.name.trim(), io: 'Audio Device', use_sdp: true, source: 'http://127.0.0.1/', sdp: f.rawSdp.trim(), delay: f.delay, ignore_refclk_gmid: f.ignoreRefclk, map }
  }

  socket.emit('aes67:sink:add', { id: nextSinkId.value, ...body }, (res) => {
    if (res?.ok) { showAddSink.value = false; refreshSinks() }
    else sinkError.value = res?.error ?? 'Failed'
    sinkBusy.value = false
  })
}
</script>

<template>
  <q-card style="background-color: #fff; width: 100%">
    <q-card-section class="card-header" style="border-top: 3px solid #7b1fa2">
      <span class="card-title">AES67</span>
      <span class="card-dir">Input</span>
      <q-btn
        flat dense round size="xs" icon="add" color="purple-7" class="q-ml-auto"
        :disable="!aoipState.aes67.ready" @click="openAddSink"
      >
        <q-tooltip>Sink 추가</q-tooltip>
      </q-btn>
    </q-card-section>
    <q-separator />
    <q-card-section>
      <div class="aes67-items">
        <div v-for="sink in sinks" :key="sink.id" class="aes67-item">
          <div class="aes67-item-head">
            <q-icon name="download" size="xs" color="green-7" />
            <span class="aes67-item-name">{{ sink.name }}</span>
            <q-badge v-if="sinkLocked(sink) !== null" outline :color="sinkLocked(sink) ? 'positive' : 'warning'" class="q-ml-xs">
              {{ sinkLocked(sink) ? 'Connected' : 'Waiting' }}
            </q-badge>
            <q-btn flat dense round size="xs" icon="delete_outline" color="negative" class="q-ml-auto"
              @click="removeSink(sink)">
              <q-tooltip>삭제</q-tooltip>
            </q-btn>
          </div>

          <div v-for="ch in sinkChannels(sink)" :key="ch.id" class="ch-strip">
            <span class="ch-tag" style="background:#7b1fa2">AES</span>
            <div class="route-spacer q-mr-md" />
            <div class="ch-main">
              <div class="ch-info">
                <span class="ch-name">{{ ch.label }}</span>
                <span class="ch-mode ch-mode--mono">Mono</span>
              </div>
              <div class="slider-wrap">
                <div v-if="dragging[ch.id] !== undefined" class="slider-thumb-tip" :style="{ left: thumbLeft(dragging[ch.id]) }">
                  {{ fmtSlider(dragging[ch.id]) }}
                </div>
                <input type="range" :value="sliderVal(g(ch))" min="-60" max="12" step="0.5" class="gain-slider"
                  @input="onSliderInput(g(ch), $event.target.value)"
                  @change="onSliderChange(g(ch), $event.target.value)"
                />
              </div>
            </div>
            <input v-if="editingId === ch.id"
              :ref="(el) => { if (el) inputRefs[ch.id] = el }"
              v-model="editingVal" class="db-input"
              @blur="commitEdit(g(ch))"
              @keydown="onEditKeydown($event, g(ch))"
            />
            <span v-else class="db-val" @click="onDbClick(g(ch))">{{ toDb(ch.gain) }}</span>
            <q-btn class="mute-btn" flat dense size="md"
              :icon="ch.muted ? 'volume_off' : 'volume_up'"
              :color="ch.muted ? 'negative' : 'blue-grey-5'"
              @click="doToggleMute(g(ch))"
            >
              <q-tooltip class="bg-grey-4 text-grey-9">Mute</q-tooltip>
            </q-btn>
            <LevelMeter :channels="[{ level: ch.level, muted: ch.muted }]" :title="ch.label" />
          </div>
        </div>

        <div v-if="!sinks.length" class="aes67-empty">
          <q-icon name="download" size="32px" color="blue-grey-3" />
          <span>{{ aoipState.aes67.ready ? '싱크 없음' : 'AES67 데몬이 실행 중이 아닙니다' }}</span>
        </div>
      </div>
    </q-card-section>
  </q-card>

  <!-- ── Add Sink Dialog ─────────────────────────────────── -->
  <q-dialog v-model="showAddSink" persistent>
    <q-card style="min-width: 460px; max-width: 95vw">
      <q-card-section class="dialog-head">
        <span class="dialog-title">Add AES67 Sink (입력)</span>
      </q-card-section>
      <q-separator />
      <q-tabs v-model="sinkTab" dense align="left" class="q-px-md q-pt-sm" active-color="primary" indicator-color="primary">
        <q-tab name="browse" label="네트워크 탐색" icon="wifi_find" />
        <q-tab name="url" label="URL" icon="link" />
        <q-tab name="sdp" label="SDP 직접 입력" icon="code" />
      </q-tabs>
      <q-separator />
      <q-card-section class="dialog-body">
        <q-tab-panels v-model="sinkTab" animated>
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
              <q-input v-model="sinkForm.url" dense outlined placeholder="http://192.168.0.x:8080/api/source/sdp/0" class="font-mono" />
            </div>
          </q-tab-panel>
          <q-tab-panel name="sdp" class="q-pa-none">
            <div class="field-group q-pt-sm">
              <label class="field-label">SDP 내용</label>
              <q-input v-model="sinkForm.rawSdp" dense outlined type="textarea" :rows="6" placeholder="v=0&#10;o=- ..." class="font-mono" />
            </div>
          </q-tab-panel>
        </q-tab-panels>
        <q-separator class="q-my-sm" />
        <div class="field-group">
          <label class="field-label">이름</label>
          <q-input v-model="sinkForm.name" dense outlined placeholder="Sink 이름" />
        </div>
        <div class="dlg-row">
          <div class="field-group" style="flex:1">
            <label class="field-label">Delay (samples)</label>
            <q-select v-model="sinkForm.delay" :options="delayOptions" emit-value map-options dense outlined />
          </div>
          <div class="field-group" style="flex:1">
            <label class="field-label">채널 단위</label>
            <q-select v-model="sinkForm.chUnit" :options="chUnitOptions" emit-value map-options dense outlined
              @update:model-value="(val) => { sinkForm.chStart = firstAvailableSlot(val) }" />
          </div>
          <div class="field-group" style="flex:2">
            <label class="field-label">채널 슬롯</label>
            <q-select v-model="sinkForm.chStart" :options="chSlotOptions(sinkForm.chUnit)"
              emit-value map-options dense outlined option-disable="disable" />
          </div>
        </div>
        <q-toggle v-model="sinkForm.ignoreRefclk" label="GM ID 무시 (Ignore refclk GMID)" color="primary" dense />
        <p v-if="sinkError" class="form-error">{{ sinkError }}</p>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right" class="dialog-actions">
        <q-btn flat label="취소" color="grey-7" v-close-popup />
        <q-btn unelevated label="추가" color="green-7" :loading="sinkBusy" @click="confirmAddSink" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 10px;
  padding-bottom: 10px;
}
.card-title { font-size: 15px; font-weight: 500; }
.card-dir { font-size: 11px; color: #90a4ae; font-weight: 400; text-transform: uppercase; letter-spacing: 0.06em; }
.route-spacer { width: 44px; height: 40px; flex-shrink: 0; }

.aes67-items { display: flex; flex-direction: column; gap: 8px; }
.aes67-item { border: 1px solid #e0e0e0; border-radius: 4px; overflow: hidden; }
.aes67-item-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
}
.aes67-item-name { font-size: 13px; font-weight: 600; color: #37474f; }

.aes67-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px;
  color: #b0bec5;
  font-size: 13px;
}

/* Dialog */
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
