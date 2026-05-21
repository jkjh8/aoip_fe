<script>
export default { inheritAttrs: false }
</script>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { socket } from 'src/boot/socket'
import { useAoipStore } from 'src/stores/aoip'
import { useChannelPanel } from 'src/composables/useChannelPanel'
import LevelMeter from 'src/components/mixer/LevelMeter.vue'
import RoutingDialog from 'src/components/mixer/RoutingDialog.vue'
import Aes67SourceAddDialog from 'src/components/aes67/Aes67SourceAddDialog.vue'
import Aes67SourceEditDialog from 'src/components/aes67/Aes67SourceEditDialog.vue'

const $q = useQuasar()
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

function hasAvailableSourceSlot() {
  const used = new Set(aoipState.aes67Sources.flatMap((s) => s.map ?? []))
  for (let i = 0; i < 16; i += 2)
    if (!used.has(i) && !used.has(i + 1)) return true
  return false
}

function openAddSource() {
  if (!hasAvailableSourceSlot()) {
    $q.notify({ type: 'negative', message: '할당 가능한 채널 슬롯이 없습니다 (최대 16ch)' })
    return
  }
  $q.dialog({ component: Aes67SourceAddDialog }).onOk(() => refreshSources())
}

function openEdit(source) {
  $q.dialog({ component: Aes67SourceEditDialog, componentProps: { source } }).onOk(() => refreshSources())
}
</script>

<template>
  <div v-bind="$attrs">
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
            <div style="margin-left:auto; display:flex; align-items:center; gap:2px">
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
  </div>
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
  opacity: 1;
  overflow: hidden;
}
.route-btn--active { border-color: #90caf9; background: #e3f2fd; }

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

</style>
