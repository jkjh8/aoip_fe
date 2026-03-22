<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { socket, aoipState } from 'src/boot/socket'
import { useChannelControl, gainToDb, dbToGain } from 'src/composables/useChannelControl'
import EqPanel from './EqPanel.vue'
import LimiterPanel from './LimiterPanel.vue'

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

function isEqActive(group) {
  const ch = group.stereo ? group.left : group.ch
  const dsp = ch?.dsp
  return !!(dsp?.hpf?.enabled || dsp?.eq?.some((b) => b.enabled))
}

function isLimiterActive(group) {
  const ch = group.stereo ? group.left : group.ch
  return ch?.dsp?.limiter?.enabled === true
}

const inputGroups = computed(() => {
  const chs = aoipState.channels.inputs
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

function isConnected(inputPort, outputPort) {
  const entry = aoipState.jack.connections.find((c) => c.port === inputPort)
  return entry ? entry.connections.includes(outputPort) : false
}

function toggleConnection(inputPort, outputPort) {
  if (isConnected(inputPort, outputPort)) {
    socket.emit('jack:disconnect', { src: inputPort, dst: outputPort })
  } else {
    socket.emit('jack:connect', { src: inputPort, dst: outputPort })
  }
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

// 모달에서 입력 채널 연결 여부 (출력 그룹 기준)
function isInConnected(inCh, outGroup) {
  if (outGroup.stereo) return isConnected(inCh.jackPort, outGroup.left.jackPort)
  return isConnected(inCh.jackPort, outGroup.ch.jackPort)
}

// 모달에서 입력 채널 토글 (스테레오 출력이면 L/R 모두)
function toggleForGroup(inCh, outGroup) {
  if (outGroup.stereo) {
    toggleConnection(inCh.jackPort, outGroup.left.jackPort)
    toggleConnection(inCh.jackPort, outGroup.right.jackPort)
  } else {
    toggleConnection(inCh.jackPort, outGroup.ch.jackPort)
  }
}

function routeInputLabel(group) {
  if (!group.stereo) return group.ch.label
  return group.left.label.replace(/\s*(CH\d+|[LR]|\d+)$/i, '').trim()
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

const { editingId, editingVal, toDb, levelPct, levelColor, setGain, toggleMute } =
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

function chLvlPct(ch, muted) {
  if (muted) return 0
  return levelPct(ch?.level)
}

function fmtLevel(level) {
  if (level == null || level <= -100) return '-inf'
  return (level >= 0 ? '+' : '') + level.toFixed(1) + ' dB'
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
    <div class="label-pad text-h6 text-weight-light">Ouputs</div>
    <q-separator />
    <template v-for="group in channelGroups" :key="groupKey(group)">
      <div class="ch-strip" :class="{ muted: isMuted(group) }">
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

        <!-- 타입 태그 -->
        <span class="ch-tag" :style="`background:${groupTag(group).color}`">
          {{ groupTag(group).text }}
        </span>

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
        <div class="level-meters">
          <template v-if="group.stereo">
            <div class="level-meter">
              <div
                class="level-fill"
                :style="`height:${chLvlPct(group.left, isMuted(group))}%; background:${levelColor(group.left.level)}`"
              />
              <q-tooltip
                class="bg-grey-4 text-grey-9"
                anchor="top middle"
                self="bottom middle"
                :offset="[0, 6]"
              >
                L: {{ fmtLevel(group.left.level) }}
              </q-tooltip>
            </div>
            <div class="level-meter">
              <div
                class="level-fill"
                :style="`height:${chLvlPct(group.right, isMuted(group))}%; background:${levelColor(group.right.level)}`"
              />
              <q-tooltip
                class="bg-grey-4 text-grey-9"
                anchor="top middle"
                self="bottom middle"
                :offset="[0, 6]"
              >
                R: {{ fmtLevel(group.right.level) }}
              </q-tooltip>
            </div>
          </template>
          <div v-else class="level-meter">
            <div
              class="level-fill"
              :style="`height:${chLvlPct(group.ch, isMuted(group))}%; background:${levelColor(group.ch.level)}`"
            />
            <q-tooltip
              class="bg-grey-4 text-grey-9"
              anchor="top middle"
              self="bottom middle"
              :offset="[0, 6]"
            >
              {{ fmtLevel(group.ch.level) }}
            </q-tooltip>
          </div>
        </div>
      </div>
    </template>

    <EqPanel
      v-model="eqOpen"
      :channel="eqChannel"
      :channel-right="eqChannelRight"
      channel-type="output"
    />

    <LimiterPanel v-model="limOpen" :channel="limChannel" :channel-right="limChannelRight" />

    <!-- 라우팅 팝업 -->
    <q-dialog v-model="routeDialogOpen" @hide="routeTarget = null">
      <q-card class="route-dialog">
        <q-card-section class="route-dialog-header">
          <span class="route-dialog-title">
            {{
              routeTarget
                ? routeTarget.stereo
                  ? stereoLabel(routeTarget.left)
                  : routeTarget.ch.label
                : ''
            }}
          </span>
          <q-btn flat dense round icon="close" size="sm" v-close-popup />
        </q-card-section>
        <!-- 스테레오 출력: L섹션(상단) / R섹션(하단) 분리 -->
        <template v-if="routeTarget && routeTarget.stereo">
          <q-card-section class="route-dialog-section-label">
            {{ stereoLabel(routeTarget.left) }} L
          </q-card-section>
          <q-card-section class="route-dialog-body">
            <template v-for="inGroup in inputGroups" :key="'L-' + groupKey(inGroup)">
              <template v-if="inGroup.stereo">
                <button
                  class="route-ch-btn"
                  :class="{ active: isConnected(inGroup.left.jackPort, routeTarget.left.jackPort) }"
                  @click="toggleConnection(inGroup.left.jackPort, routeTarget.left.jackPort)"
                >
                  <span
                    class="route-ch-tag"
                    :style="`background:${inputTypeTag(inGroup.left.label).color}`"
                    >{{ inputTypeTag(inGroup.left.label).text }}</span
                  >
                  <span class="route-ch-name">{{ routeInputLabel(inGroup) }} L</span>
                </button>
                <button
                  class="route-ch-btn"
                  :class="{
                    active: isConnected(inGroup.right.jackPort, routeTarget.left.jackPort),
                  }"
                  @click="toggleConnection(inGroup.right.jackPort, routeTarget.left.jackPort)"
                >
                  <span
                    class="route-ch-tag"
                    :style="`background:${inputTypeTag(inGroup.right.label).color}`"
                    >{{ inputTypeTag(inGroup.right.label).text }}</span
                  >
                  <span class="route-ch-name">{{ routeInputLabel(inGroup) }} R</span>
                </button>
              </template>
              <template v-else>
                <button
                  class="route-ch-btn"
                  :class="{ active: isConnected(inGroup.ch.jackPort, routeTarget.left.jackPort) }"
                  @click="toggleConnection(inGroup.ch.jackPort, routeTarget.left.jackPort)"
                >
                  <span
                    class="route-ch-tag"
                    :style="`background:${inputTypeTag(inGroup.ch.label).color}`"
                    >{{ inputTypeTag(inGroup.ch.label).text }}</span
                  >
                  <span class="route-ch-name">{{ inGroup.ch.label }}</span>
                </button>
              </template>
            </template>
          </q-card-section>
          <q-separator />
          <q-card-section class="route-dialog-section-label">
            {{ stereoLabel(routeTarget.left) }} R
          </q-card-section>
          <q-card-section class="route-dialog-body">
            <template v-for="inGroup in inputGroups" :key="'R-' + groupKey(inGroup)">
              <template v-if="inGroup.stereo">
                <button
                  class="route-ch-btn"
                  :class="{
                    active: isConnected(inGroup.left.jackPort, routeTarget.right.jackPort),
                  }"
                  @click="toggleConnection(inGroup.left.jackPort, routeTarget.right.jackPort)"
                >
                  <span
                    class="route-ch-tag"
                    :style="`background:${inputTypeTag(inGroup.left.label).color}`"
                    >{{ inputTypeTag(inGroup.left.label).text }}</span
                  >
                  <span class="route-ch-name">{{ routeInputLabel(inGroup) }} L</span>
                </button>
                <button
                  class="route-ch-btn"
                  :class="{
                    active: isConnected(inGroup.right.jackPort, routeTarget.right.jackPort),
                  }"
                  @click="toggleConnection(inGroup.right.jackPort, routeTarget.right.jackPort)"
                >
                  <span
                    class="route-ch-tag"
                    :style="`background:${inputTypeTag(inGroup.right.label).color}`"
                    >{{ inputTypeTag(inGroup.right.label).text }}</span
                  >
                  <span class="route-ch-name">{{ routeInputLabel(inGroup) }} R</span>
                </button>
              </template>
              <template v-else>
                <button
                  class="route-ch-btn"
                  :class="{ active: isConnected(inGroup.ch.jackPort, routeTarget.right.jackPort) }"
                  @click="toggleConnection(inGroup.ch.jackPort, routeTarget.right.jackPort)"
                >
                  <span
                    class="route-ch-tag"
                    :style="`background:${inputTypeTag(inGroup.ch.label).color}`"
                    >{{ inputTypeTag(inGroup.ch.label).text }}</span
                  >
                  <span class="route-ch-name">{{ inGroup.ch.label }}</span>
                </button>
              </template>
            </template>
          </q-card-section>
        </template>

        <!-- 모노 출력: 단일 섹션 -->
        <q-card-section v-else class="route-dialog-body">
          <template v-for="inGroup in inputGroups" :key="groupKey(inGroup)">
            <template v-if="inGroup.stereo">
              <button
                class="route-ch-btn"
                :class="{ active: routeTarget && isInConnected(inGroup.left, routeTarget) }"
                @click="routeTarget && toggleForGroup(inGroup.left, routeTarget)"
              >
                <span
                  class="route-ch-tag"
                  :style="`background:${inputTypeTag(inGroup.left.label).color}`"
                  >{{ inputTypeTag(inGroup.left.label).text }}</span
                >
                <span class="route-ch-name">{{ routeInputLabel(inGroup) }} L</span>
              </button>
              <button
                class="route-ch-btn"
                :class="{ active: routeTarget && isInConnected(inGroup.right, routeTarget) }"
                @click="routeTarget && toggleForGroup(inGroup.right, routeTarget)"
              >
                <span
                  class="route-ch-tag"
                  :style="`background:${inputTypeTag(inGroup.right.label).color}`"
                  >{{ inputTypeTag(inGroup.right.label).text }}</span
                >
                <span class="route-ch-name">{{ routeInputLabel(inGroup) }} R</span>
              </button>
            </template>
            <template v-else>
              <button
                class="route-ch-btn"
                :class="{ active: routeTarget && isInConnected(inGroup.ch, routeTarget) }"
                @click="routeTarget && toggleForGroup(inGroup.ch, routeTarget)"
              >
                <span
                  class="route-ch-tag"
                  :style="`background:${inputTypeTag(inGroup.ch.label).color}`"
                  >{{ inputTypeTag(inGroup.ch.label).text }}</span
                >
                <span class="route-ch-name">{{ inGroup.ch.label }}</span>
              </button>
            </template>
          </template>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<style scoped>
/* 공통 클래스는 src/css/app.scss 참조 */

.label-pad {
  padding-left: 75px;
}

/* 라우팅 버튼 — 모노/스테레오 동일 고정 사이즈 */
.route-btn {
  background: transparent;
  border: 1px solid #b0bec5;
  border-radius: 4px;
  width: 48px;
  height: 40px;
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

/* 라우팅 팝업 */
.route-dialog {
  min-width: 200px;
  max-width: 380px;
  margin: auto;
}
.route-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px 8px;
  border-bottom: 1px solid #e4e6ea;
}
.route-dialog-title {
  font-size: 13px;
  font-weight: 700;
  color: #37474f;
}
.route-dialog-section-label {
  font-size: 11px;
  font-weight: 700;
  color: #78909c;
  letter-spacing: 1px;
  text-transform: uppercase;
  padding: 8px 14px 4px;
}
.route-dialog-body {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: auto;
  margin: auto;
}
.route-ch-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f5f5f5;
  border: 1px solid #cfd8dc;
  border-radius: 5px;
  padding: 6px 10px;
  cursor: pointer;
  transition:
    background 0.1s,
    border-color 0.1s;
  min-width: 110px;
}
.route-ch-btn:hover {
  background: #e0e0e0;
  border-color: #90a4ae;
}
.route-ch-btn.active {
  background: #1565c0;
  border-color: #1565c0;
}
.route-ch-btn.active .route-ch-name {
  color: #fff;
}
.route-ch-tag {
  font-size: 8px;
  font-weight: 800;
  color: #fff;
  padding: 2px 5px;
  border-radius: 3px;
  flex-shrink: 0;
}
.route-ch-name {
  font-size: 11px;
  font-weight: 600;
  color: #37474f;
  white-space: nowrap;
}
</style>
