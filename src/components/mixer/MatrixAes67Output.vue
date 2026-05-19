<script setup>
import { ref, computed, onMounted } from 'vue'
import { socket } from 'src/boot/socket'
import { useAoipStore } from 'src/stores/aoip'
import { useChannelPanel } from 'src/composables/useChannelPanel'
import LevelMeter from 'src/components/mixer/LevelMeter.vue'
import RoutingDialog from 'src/components/mixer/RoutingDialog.vue'

const aoipState = useAoipStore()

const {
  doToggleMute,
  dragging, sliderVal, onSliderInput, thumbLeft, fmtSlider, onSliderChange,
  editingId, inputRefs, editingVal, commitEdit, onEditKeydown, toDb, onDbClick,
  getChannelType, typeTag,
} = useChannelPanel('output')

const aes67Chs = computed(() =>
  aoipState.channels.outputs.filter((ch) => ch.label.toLowerCase().includes('aes67')),
)

const sources = computed(() => aoipState.aes67Sources)

function sourceChannels(source) {
  return (source.map ?? []).map((idx) => aes67Chs.value[idx]).filter(Boolean)
}

function g(ch) { return { stereo: false, ch } }

function refreshSources() {
  socket.emit('aes67:sources:list', (res) => {
    if (res?.ok) aoipState.aes67Sources = res.sources ?? []
  })
}

onMounted(() => {
  if (!aoipState.aes67Sources.length) refreshSources()
})

// ── Routing ───────────────────────────────────────────────
const routeTarget = ref(null)
const routeDialogOpen = computed({
  get: () => routeTarget.value !== null,
  set: (v) => { if (!v) routeTarget.value = null },
})

function isConnected(inputPort, outputPort) {
  const entry = aoipState.connections.find((c) => c.port === inputPort)
  return entry ? entry.connections.includes(outputPort) : false
}

const TYPE_ORDER = ['analog', 'stream', 'aes67', 'other']
const TYPE_COLS  = { analog: 4, stream: 4, aes67: 4, other: 4 }

function dotGroups(outGroup) {
  const port = outGroup.stereo ? outGroup.left.port : outGroup.ch.port
  const byType = {}
  for (const ch of aoipState.filteredInputs) {
    const t = getChannelType(ch.label)
    if (!byType[t]) byType[t] = []
    byType[t].push({
      port: ch.port,
      color: isConnected(ch.port, port) ? typeTag(ch.label).color : '#d0d0d0',
      connected: isConnected(ch.port, port),
    })
  }
  return TYPE_ORDER
    .filter((t) => byType[t]?.length)
    .map((t) => ({ type: t, cols: TYPE_COLS[t], dots: byType[t] }))
}

function hasConnected(outGroup) {
  return dotGroups(outGroup).some((grp) => grp.dots.some((d) => d.connected))
}

// ── Delete source ─────────────────────────────────────────
function removeSource(source) {
  if (!confirm(`"${source.name}" 소스를 삭제하시겠습니까?`)) return
  socket.emit('aes67:source:remove', { id: source.id }, (res) => {
    if (res?.ok) refreshSources()
  })
}

// ── Toggle enable ─────────────────────────────────────────
const busyMap = ref({})

function toggleEnabled(source) {
  if (busyMap.value[source.id]) return
  busyMap.value[source.id] = true
  const { id, ...rest } = source
  socket.emit('aes67:source:add', { id, ...rest, enabled: !source.enabled }, (res) => {
    busyMap.value[source.id] = false
    if (!res?.ok) console.error('[aes67] toggle failed', res?.error)
  })
}

// ── Channel slot options (disable used slots) ─────────────
function usedSlots(excludeId = null) {
  const used = new Set()
  for (const s of aoipState.aes67Sources) {
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

// ── Edit source dialog ────────────────────────────────────
const showEdit = ref(false)
const editBusy = ref(false)
const editError = ref('')
const editingSource = ref(null)
const editForm = ref({})

const codecOptions = ['L16', 'L24', 'AM824']
const sppOptions = [12, 24, 48, 96, 192]
const chUnitOptions = [{ label: '2ch', value: 2 }, { label: '8ch', value: 8 }]

function openEdit(source) {
  editingSource.value = source
  const mapLen = source.map?.length ?? 2
  editForm.value = {
    name: source.name,
    address: source.address,
    codec: source.codec,
    max_samples_per_packet: source.max_samples_per_packet,
    chUnit: mapLen >= 8 ? 8 : 2,
    chStart: source.map?.[0] ?? 0,
    ttl: source.ttl ?? 15,
  }
  editError.value = ''
  showEdit.value = true
}

function confirmEdit() {
  const f = editForm.value
  const source = editingSource.value
  if (!f.name.trim()) { editError.value = '이름을 입력하세요'; return }
  if (!f.address.trim()) { editError.value = '주소를 입력하세요'; return }

  const map = Array.from({ length: f.chUnit }, (_, i) => f.chStart + i)
  const others = aoipState.aes67Sources.filter((s) => s.id !== source.id)

  const addrConflict = others.find((s) => s.address === f.address.trim())
  if (addrConflict) { editError.value = `주소 ${f.address.trim()}는 "${addrConflict.name}"에서 이미 사용 중입니다`; return }

  const mapSet = new Set(map)
  const chConflict = others.find((s) => (s.map ?? []).some((ch) => mapSet.has(ch)))
  if (chConflict) {
    const used = chConflict.map.filter((ch) => mapSet.has(ch)).map((ch) => `Ch ${ch + 1}`).join(', ')
    editError.value = `채널이 "${chConflict.name}"과 겹칩니다 (${used})`
    return
  }

  editBusy.value = true
  editError.value = ''
  socket.emit('aes67:source:add', {
    ...source,
    name: f.name.trim(),
    address: f.address.trim(),
    codec: f.codec,
    max_samples_per_packet: f.max_samples_per_packet,
    ttl: f.ttl,
    map,
  }, (res) => {
    editBusy.value = false
    if (res?.ok) { showEdit.value = false; refreshSources() }
    else editError.value = res?.error ?? 'Failed'
  })
}

// ── Add Source dialog ─────────────────────────────────────
const showAddSource = ref(false)
const srcBusy = ref(false)
const srcError = ref('')

const nextSourceId = computed(() =>
  sources.value.length ? Math.max(...sources.value.map((s) => s.id)) + 1 : 0,
)

const srcCodecOptions = ['L16', 'L24', 'AM824']
const srcSppOptions = [12, 24, 48, 96, 192]

const srcForm = ref({ name: '', address: '239.69.0.1', codec: 'L24', spp: 48, chUnit: 2, chStart: 0, ttl: 15 })

function openAddSource() {
  const chUnit = 2
  srcForm.value = { name: '', address: '239.69.0.1', codec: 'L24', spp: 48, chUnit, chStart: firstAvailableSlot(chUnit), ttl: 15 }
  srcError.value = ''
  showAddSource.value = true
}

function confirmAddSource() {
  const f = srcForm.value
  if (!f.name.trim()) { srcError.value = '이름을 입력하세요'; return }
  if (!f.address.trim()) { srcError.value = '주소를 입력하세요'; return }

  const map = Array.from({ length: f.chUnit }, (_, i) => f.chStart + i)

  const addrConflict = sources.value.find((s) => s.address === f.address.trim())
  if (addrConflict) { srcError.value = `주소 ${f.address.trim()}는 "${addrConflict.name}"에서 이미 사용 중입니다`; return }

  const mapSet = new Set(map)
  const chConflict = sources.value.find((s) => (s.map ?? []).some((ch) => mapSet.has(ch)))
  if (chConflict) {
    const used = chConflict.map.filter((ch) => mapSet.has(ch)).map((ch) => `Ch ${ch + 1}`).join(', ')
    srcError.value = `채널이 "${chConflict.name}"과 겹칩니다 (${used})`
    return
  }

  srcBusy.value = true
  srcError.value = ''
  socket.emit('aes67:source:add', {
    id: nextSourceId.value, enabled: true,
    name: f.name.trim(), io: 'Audio Device',
    address: f.address.trim(), codec: f.codec,
    max_samples_per_packet: f.spp, ttl: f.ttl,
    payload_type: 98, dscp: 34, refclk_ptp_traceable: false, map,
  }, (res) => {
    if (res?.ok) { showAddSource.value = false; refreshSources() }
    else srcError.value = res?.error ?? 'Failed'
    srcBusy.value = false
  })
}
</script>

<template>
  <q-card style="background-color: #fff; width: 100%">
    <q-card-section class="card-header" style="border-top: 3px solid #7b1fa2">
      <span class="card-title">AES67</span>
      <span class="card-dir">Output</span>
      <q-btn
        flat dense round size="xs" icon="add" color="purple-7" class="q-ml-auto"
        :disable="!aoipState.aes67.ready" @click="openAddSource"
      >
        <q-tooltip>Source 추가</q-tooltip>
      </q-btn>
    </q-card-section>
    <q-separator />
    <q-card-section>
      <div class="aes67-items">
        <div v-for="source in sources" :key="source.id" class="aes67-item">
          <div class="aes67-item-head">
            <q-icon name="upload" size="xs" color="blue-7" />
            <span class="aes67-item-name">{{ source.name }}</span>
            <q-badge outline :color="source.enabled ? 'positive' : 'grey-5'" class="q-ml-xs">
              {{ source.enabled ? 'ON' : 'OFF' }}
            </q-badge>
            <q-btn flat dense round size="xs"
              :icon="source.enabled ? 'pause_circle' : 'play_circle'"
              :color="source.enabled ? 'orange-7' : 'positive'"
              :loading="busyMap[source.id]"
              @click="toggleEnabled(source)">
              <q-tooltip>{{ source.enabled ? 'Disable' : 'Enable' }}</q-tooltip>
            </q-btn>
            <q-btn flat dense round size="xs" icon="edit" color="grey-6" @click="openEdit(source)">
              <q-tooltip>수정</q-tooltip>
            </q-btn>
            <q-btn flat dense round size="xs" icon="delete_outline" color="negative" @click="removeSource(source)">
              <q-tooltip>삭제</q-tooltip>
            </q-btn>
          </div>

          <div v-for="ch in sourceChannels(source)" :key="ch.id" class="ch-strip">
            <span class="ch-tag" style="background:#7b1fa2">AES</span>

            <button
              class="route-btn q-mr-md"
              :class="{ 'route-btn--active': hasConnected(g(ch)) }"
              title="Routing"
              @click="routeTarget = g(ch)"
            >
              <span
                v-for="dg in dotGroups(g(ch))"
                :key="dg.type"
                class="route-dots"
                :style="`width:${dg.cols * 5 + (dg.cols - 1) * 2}px`"
              >
                <span
                  v-for="dot in dg.dots"
                  :key="dot.port"
                  class="route-dot"
                  :style="`background:${dot.color}`"
                />
              </span>
            </button>

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

        <div v-if="!sources.length" class="aes67-empty">
          <q-icon name="upload" size="32px" color="blue-grey-3" />
          <span>{{ aoipState.aes67.ready ? '소스 없음' : 'AES67 데몬이 실행 중이 아닙니다' }}</span>
        </div>
      </div>
    </q-card-section>
  </q-card>

  <RoutingDialog v-model="routeDialogOpen" :route-target="routeTarget" />

  <!-- ── Edit Source Dialog ──────────────────────────────── -->
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
            <button v-for="c in codecOptions" :key="c" class="seg-btn" :class="{ 'seg-btn--on': editForm.codec === c }" @click="editForm.codec = c">{{ c }}</button>
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">Samples / Packet (Ptime)</label>
          <div class="seg-group">
            <button v-for="n in sppOptions" :key="n" class="seg-btn seg-btn--sm" :class="{ 'seg-btn--on': editForm.max_samples_per_packet === n }" @click="editForm.max_samples_per_packet = n">{{ n }}</button>
          </div>
        </div>
        <div class="dlg-row">
          <div class="field-group" style="flex:1">
            <label class="field-label">채널 단위</label>
            <q-select v-model="editForm.chUnit" :options="chUnitOptions" emit-value map-options dense outlined @update:model-value="(val) => { editForm.chStart = firstAvailableSlot(val, editingSource?.id) }" />
          </div>
          <div class="field-group" style="flex:2">
            <label class="field-label">채널 슬롯</label>
            <q-select v-model="editForm.chStart" :options="chSlotOptions(editForm.chUnit, editingSource?.id)"
              emit-value map-options dense outlined option-disable="disable" />
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

  <!-- ── Add Source Dialog ───────────────────────────────── -->
  <q-dialog v-model="showAddSource" persistent>
    <q-card style="min-width: 400px">
      <q-card-section class="dialog-head">
        <span class="dialog-title">Add AES67 Source (출력)</span>
      </q-card-section>
      <q-separator />
      <q-card-section class="dialog-body">
        <div class="field-group">
          <label class="field-label">이름</label>
          <q-input v-model="srcForm.name" dense outlined placeholder="Source 이름" autofocus />
        </div>
        <div class="field-group">
          <label class="field-label">Multicast Address</label>
          <q-input v-model="srcForm.address" dense outlined placeholder="239.69.x.x" class="font-mono" />
        </div>
        <div class="field-group">
          <label class="field-label">Codec</label>
          <div class="seg-group">
            <button v-for="c in srcCodecOptions" :key="c" class="seg-btn" :class="{ 'seg-btn--on': srcForm.codec === c }" @click="srcForm.codec = c">{{ c }}</button>
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">Samples / Packet (Ptime)</label>
          <div class="seg-group">
            <button v-for="n in srcSppOptions" :key="n" class="seg-btn seg-btn--sm" :class="{ 'seg-btn--on': srcForm.spp === n }" @click="srcForm.spp = n">{{ n }}</button>
          </div>
        </div>
        <div class="dlg-row">
          <div class="field-group" style="flex:1">
            <label class="field-label">채널 단위</label>
            <q-select v-model="srcForm.chUnit" :options="chUnitOptions" emit-value map-options dense outlined @update:model-value="(val) => { srcForm.chStart = firstAvailableSlot(val) }" />
          </div>
          <div class="field-group" style="flex:2">
            <label class="field-label">채널 슬롯</label>
            <q-select v-model="srcForm.chStart" :options="chSlotOptions(srcForm.chUnit)"
              emit-value map-options dense outlined option-disable="disable" />
          </div>
        </div>
        <p v-if="srcError" class="form-error">{{ srcError }}</p>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right" class="dialog-actions">
        <q-btn flat label="취소" color="grey-7" v-close-popup />
        <q-btn unelevated label="추가" color="blue-7" :loading="srcBusy" @click="confirmAddSource" />
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

.route-btn {
  background: transparent;
  border: 1px solid #b0bec5;
  border-radius: 4px;
  width: 44px;
  height: 40px;
  cursor: pointer;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  color: #546e7a;
  padding: 4px;
  opacity: 0;
  overflow: hidden;
}
.route-btn--active { border-color: #90caf9; background: #e3f2fd; opacity: 1; }

.route-dots {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}
.route-dot {
  width: 5px;
  height: 5px;
  border-radius: 1px;
  flex-shrink: 0;
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

.seg-group { display: flex; gap: 5px; flex-wrap: wrap; }
.seg-btn {
  background: #f5f5f5; border: 1px solid #cfd8dc; border-radius: 3px;
  padding: 6px 13px; font-size: 13px; font-weight: 600; color: #546e7a; cursor: pointer;
  transition: background 0.1s, color 0.1s;
}
.seg-btn--sm { padding: 5px 10px; font-size: 12px; }
.seg-btn:hover { background: #e3f2fd; border-color: #90caf9; }
.seg-btn--on { background: #1565c0; border-color: #1565c0; color: #fff; }
</style>
