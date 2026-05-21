<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { socket } from 'src/boot/socket'
import { useAoipStore } from 'src/stores/aoip'
import { useChannelPanel } from 'src/composables/useChannelPanel'
import LevelMeter from 'src/components/mixer/LevelMeter.vue'
import Aes67SinkAddDialog from 'src/components/aes67/Aes67SinkAddDialog.vue'

const $q = useQuasar()
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

function hasAvailableSinkSlot() {
  const used = new Set(aoipState.aes67Sinks.flatMap((s) => s.map ?? []))
  for (let i = 0; i < 16; i += 2)
    if (!used.has(i) && !used.has(i + 1)) return true
  return false
}

function openAddSink() {
  if (!hasAvailableSinkSlot()) {
    $q.notify({ type: 'negative', message: '할당 가능한 채널 슬롯이 없습니다 (최대 16ch)' })
    return
  }
  $q.dialog({ component: Aes67SinkAddDialog }).onOk(() => refreshSinks())
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

</style>
