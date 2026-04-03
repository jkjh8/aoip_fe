<script setup>
import { computed, nextTick, ref, watch } from 'vue'
// import { socket } from 'src/boot/socket'
import { useAoipStore } from 'src/stores/aoip'
const aoipState = useAoipStore()
import { useChannelControl, gainToDb, dbToGain } from 'src/composables/useChannelControl'
import EqPanel from './EqPanel.vue'
import LevelMeter from './LevelMeter.vue'
import LimiterPanel from './LimiterPanel.vue'
import RoutingDialog from './RoutingDialog.vue'

const channels = computed(() => aoipState.channels.outputs)
const inputRefs = ref({})
const dragging = ref({})
// routeTarget: { jackPort, label } — 단일 출력 포트
const routeTarget = ref(null)

const eqOpen = ref(false)
const eqChannel = ref(null)
const eqChannelRight = ref(null)

function openEq(group) {
  eqChannel.value = group.stereo ? group.left : group.ch
  eqChannelRight.value = group.stereo ? group.right : null
  eqOpen.value = true
}

const limOpen = ref(false)
const limChannel = ref(null)
const limChannelRight = ref(null)

function openLimiter(group) {
  limChannel.value = group.stereo ? group.left : group.ch
  limChannelRight.value = group.stereo ? group.right : null
  limOpen.value = true
}

function hasDsp(group) {
  const ch = group.stereo ? group.left : group.ch
  return ch?.dsp != null && ch?.bypassDsp !== true
}

function isEqActive(group) {
  const ch = group.stereo ? group.left : group.ch
  const dsp = ch?.dsp
  return !!(dsp?.hpf?.enabled || dsp?.eq?.some((b) => b.enabled))
}

function isLimiterActive(group) {
  const ch = group.stereo ? group.left : group.ch
  return ch?.dsp?.limiter?.enabled === true
}

function isConnected(inputPort, outputPort) {
  const entry = aoipState.jack.connections.find((c) => c.port === inputPort)
  return entry ? entry.connections.includes(outputPort) : false
}

// 모든 입력 채널 순서대로 dot 목록 (연결=컬러, 미연결=회색)
// outGroup이 stereo면 left port 기준으로 연결 여부 판단
function allDots(outGroup) {
  const port = outGroup.stereo ? outGroup.left.jackPort : outGroup.ch.jackPort
  return aoipState.channels.inputs.map((ch) => ({
    port: ch.jackPort,
    color: isConnected(ch.jackPort, port) ? inputTypeTag(ch.label).color : '#d0d0d0',
    connected: isConnected(ch.jackPort, port),
  }))
}

const routeDialogOpen = computed({
  get: () => routeTarget.value !== null,
  set: (v) => {
    if (!v) routeTarget.value = null
  },
})

function inputTypeTag(label) {
  const l = label.toLowerCase()
  if (l.includes('analog')) return { text: 'ANA', color: '#1976d2' }
  if (l.includes('aes67')) return { text: 'AES', color: '#7b1fa2' }
  if (l.includes('usb')) return { text: 'USB', color: '#388e3c' }
  return { text: label.substring(0, 3).toUpperCase(), color: '#546e7a' }
}

const { editingId, editingVal, toDb, setGain, toggleMute } =
  useChannelControl('output')

const channelGroups = computed(() => {
  const chs = channels.value
  const groups = []
  let i = 0
  while (i < chs.length) {
    const ch = chs[i]
    if (ch.label.toLowerCase().includes('analog')) {
      groups.push({ stereo: false, ch })
      i++
    } else {
      const next = chs[i + 1]
      if (next && !next.label.toLowerCase().includes('analog')) {
        groups.push({ stereo: true, left: ch, right: next })
        i += 2
      } else {
        groups.push({ stereo: false, ch })
        i++
      }
    }
  }
  return groups
})

function typeTag(label) {
  const l = label.toLowerCase()
  if (l.includes('analog')) return { text: 'ANA', color: '#1976d2' }
  if (l.includes('aes67')) return { text: 'AES', color: '#7b1fa2' }
  if (l.includes('usb')) return { text: 'USB', color: '#388e3c' }
  return { text: label.substring(0, 3).toUpperCase(), color: '#546e7a' }
}

function groupTag(group) {
  return typeTag(group.stereo ? group.left.label : group.ch.label)
}

function stereoLabel(left) {
  return left.label.replace(/\s*(CH\d+|[LR]|\d+)$/i, '').trim()
}

function isMuted(group) {
  return group.stereo ? group.left.muted && group.right.muted : group.ch.muted
}

function doToggleMute(group) {
  if (group.stereo) {
    const muted = isMuted(group)
    toggleMute(group.left.id, muted)
    toggleMute(group.right.id, muted)
  } else {
    toggleMute(group.ch.id, group.ch.muted)
  }
}

function groupGain(group) {
  return group.stereo ? group.left.gain : group.ch.gain
}

function groupKey(group) {
  return group.stereo ? group.left.id : group.ch.id
}

function sliderVal(group) {
  return dragging.value[groupKey(group)] ?? gainToDb(groupGain(group))
}
function onSliderInput(group, val) {
  dragging.value[groupKey(group)] = Number(val)
}

function thumbLeft(val) {
  const pct = ((Number(val) + 60) / 72) * 100
  return `calc(${pct.toFixed(2)}% - ${(pct * 0.14).toFixed(1)}px + 7px)`
}
function fmtSlider(val) {
  const v = Number(val)
  if (v <= -60) return '-inf'
  return (v >= 0 ? '+' : '') + v.toFixed(1) + ' dB'
}
function onSliderChange(group, val) {
  const gain = dbToGain(Number(val))
  if (group.stereo) {
    setGain(group.left.id, gain)
    setGain(group.right.id, gain)
  } else {
    setGain(group.ch.id, gain)
  }
}

async function onDbClick(group) {
  const id = groupKey(group)
  editingId.value = id
  editingVal.value = gainToDb(groupGain(group)).toFixed(1)
  await nextTick()
  inputRefs.value[id]?.focus()
  inputRefs.value[id]?.select()
}

function commitEdit(group) {
  const db = parseFloat(editingVal.value)
  if (!isNaN(db)) {
    const gain = dbToGain(Math.max(-60, Math.min(12, db)))
    if (group.stereo) {
      setGain(group.left.id, gain)
      setGain(group.right.id, gain)
    } else {
      setGain(group.ch.id, gain)
    }
  }
  editingId.value = null
  editingVal.value = ''
}

function onEditKeydown(e, group) {
  if (e.key === 'Enter') commitEdit(group)
  if (e.key === 'Escape') {
    editingId.value = null
    editingVal.value = ''
  }
}

watch(
  () => aoipState.channels.outputs.map((c) => c.gain),
  (newGains, oldGains) => {
    if (!oldGains) return
    aoipState.channels.outputs.forEach((ch, i) => {
      if (newGains[i] !== oldGains[i]) delete dragging.value[ch.id]
    })
  },
)
</script>

<template>
  <div class="ch-panel">
    <div class="text-h6 text-weight-light">Ouputs</div>
    <q-separator />
    <template v-for="group in channelGroups" :key="groupKey(group)">
      <div class="ch-strip" :class="{ muted: isMuted(group) }">
        <!-- 타입 태그 -->
        <span class="ch-tag" :style="`background:${groupTag(group).color}`">
          {{ groupTag(group).text }}
        </span>
        <!-- 라우팅 버튼 -->
        <button
          class="route-btn q-mr-md"
          :class="{ 'route-btn--active': allDots(group).some((d) => d.connected) }"
          title="Routing"
          @click="routeTarget = group"
        >
          <span class="route-dots">
            <span
              v-for="dot in allDots(group)"
              :key="dot.port"
              class="route-dot"
              :style="`background:${dot.color}`"
            />
          </span>
        </button>
        <!-- 이름 + 슬라이더 (flat) -->
        <div class="ch-main">
          <div class="ch-info">
            <span class="ch-name">{{
              group.stereo ? stereoLabel(group.left) : group.ch.label
            }}</span>
            <span class="ch-mode" :class="group.stereo ? 'ch-mode--st' : 'ch-mode--mono'">
              {{ group.stereo ? 'Stereo' : 'Mono' }}
            </span>
          </div>
          <div class="slider-wrap">
            <div
              v-if="dragging[groupKey(group)] !== undefined"
              class="slider-thumb-tip"
              :style="{ left: thumbLeft(sliderVal(group)) }"
            >
              {{ fmtSlider(sliderVal(group)) }}
            </div>
            <input
              type="range"
              :value="sliderVal(group)"
              min="-60"
              max="12"
              step="0.5"
              class="gain-slider"
              @input="onSliderInput(group, $event.target.value)"
              @change="onSliderChange(group, $event.target.value)"
            />
          </div>
        </div>

        <!-- 게인 숫자창 -->
        <input
          v-if="editingId === groupKey(group)"
          :ref="
            (el) => {
              if (el) inputRefs[groupKey(group)] = el
            }
          "
          v-model="editingVal"
          class="db-input"
          @blur="commitEdit(group)"
          @keydown="onEditKeydown($event, group)"
        />
        <span v-else class="db-val" @click="onDbClick(group)">{{ toDb(groupGain(group)) }}</span>

        <!-- 뮤트 -->
        <q-btn
          class="mute-btn"
          flat
          dense
          size="md"
          :icon="isMuted(group) ? 'volume_off' : 'volume_up'"
          :color="isMuted(group) ? 'negative' : 'blue-grey-5'"
          @click="doToggleMute(group)"
        >
          <q-tooltip
            class="bg-grey-4 text-grey-9"
            anchor="top middle"
            self="bottom middle"
            :offset="[0, 4]"
          >
            Mute
          </q-tooltip>
        </q-btn>

        <!-- EQ -->
        <q-btn
          flat
          dense
          size="md"
          icon="equalizer"
          :color="isEqActive(group) ? 'blue-7' : 'blue-grey-5'"
          :style="!hasDsp(group) ? 'visibility:hidden;pointer-events:none' : ''"
          @click="openEq(group)"
        >
          <q-tooltip
            class="bg-grey-4 text-grey-9"
            anchor="top middle"
            self="bottom middle"
            :offset="[0, 4]"
            >EQ</q-tooltip
          >
        </q-btn>

        <!-- Limiter -->
        <q-btn
          flat
          dense
          size="md"
          icon="compress"
          :style="!hasDsp(group) ? 'visibility:hidden;pointer-events:none' : ''"
          :color="isLimiterActive(group) ? 'red-7' : 'blue-grey-5'"
          @click="openLimiter(group)"
        >
          <q-tooltip
            class="bg-grey-4 text-grey-9"
            anchor="top middle"
            self="bottom middle"
            :offset="[0, 4]"
            >Limiter</q-tooltip
          >
        </q-btn>

        <!-- 레벨 미터 (vertical) -->
        <LevelMeter
          :channels="group.stereo
            ? [
                { level: group.left.level, muted: isMuted(group), label: 'L' },
                { level: group.right.level, muted: isMuted(group), label: 'R' },
              ]
            : [{ level: group.ch.level, muted: isMuted(group) }]
          "
        />
      </div>
    </template>

    <EqPanel
      v-model="eqOpen"
      :channel="eqChannel"
      :channel-right="eqChannelRight"
      channel-type="output"
    />

    <LimiterPanel v-model="limOpen" :channel="limChannel" :channel-right="limChannelRight" />

    <RoutingDialog v-model="routeDialogOpen" :route-target="routeTarget" />
  </div>
</template>

<style scoped>
/* 라우팅 버튼 — 모노/스테레오 동일 고정 사이즈 */
.route-btn {
  background: transparent;
  border: 1px solid #b0bec5;
  border-radius: 4px;
  width: 48px;
  height: 42px;
  cursor: pointer;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  color: #546e7a;
  padding: 0;
}
.route-btn:hover {
  background: #eceff1;
  border-color: #78909c;
}
.route-btn--active {
  border-color: #90caf9;
  background: #e3f2fd;
}

.route-dots {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  width: 19px; /* dot 5px × 3 + gap 2px × 2 = 19px → 3열 */
}
.route-dot {
  width: 5px;
  height: 5px;
  border-radius: 1px;
  flex-shrink: 0;
}
</style>
