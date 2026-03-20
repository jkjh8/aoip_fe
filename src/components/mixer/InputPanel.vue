<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { aoipState } from 'src/boot/socket'
import { useChannelControl, gainToDb, dbToGain } from 'src/composables/useChannelControl'
import EqPanel from './EqPanel.vue'

const channels = computed(() => aoipState.channels.inputs)
const inputRefs = ref({})
const dragging = ref({})

const eqOpen = ref(false)
const eqChannel = ref(null)
const eqChannelRight = ref(null)

function openEq(group) {
  eqChannel.value = group.stereo ? group.left : group.ch
  eqChannelRight.value = group.stereo ? group.right : null
  eqOpen.value = true
}

function isEqActive(group) {
  const ch = group.stereo ? group.left : group.ch
  const dsp = ch?.dsp
  return !!(dsp?.hpf?.enabled || dsp?.eq?.some(b => b.enabled))
}

const { editingId, editingVal, toDb, levelPct, levelColor, setGain, toggleMute } =
  useChannelControl('input')

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
  const pct = ((Number(val) + 60) / 66) * 100
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
    const gain = dbToGain(Math.max(-60, Math.min(6, db)))
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
  () => aoipState.channels.inputs.map((c) => c.gain),
  (newGains, oldGains) => {
    if (!oldGains) return
    aoipState.channels.inputs.forEach((ch, i) => {
      if (newGains[i] !== oldGains[i]) delete dragging.value[ch.id]
    })
  },
)
</script>

<template>
  <div class="ch-panel">
    <div class="text-h6 text-weight-light">Inputs</div>
    <q-separator />
    <template v-for="group in channelGroups" :key="groupKey(group)">
      <div class="ch-strip" :class="{ muted: isMuted(group) }">
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
              max="6"
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
        <q-btn flat dense size="md" icon="equalizer" :color="isEqActive(group) ? 'blue-7' : 'blue-grey-5'" @click="openEq(group)">
          <q-tooltip
            class="bg-grey-4 text-grey-9"
            anchor="top middle"
            self="bottom middle"
            :offset="[0, 4]"
          >
            EQ
          </q-tooltip>
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
  </div>

  <EqPanel
    v-model="eqOpen"
    :channel="eqChannel"
    :channel-right="eqChannelRight"
    channel-type="input"
  />
</template>

<style scoped>
.ch-panel {
  min-width: 340px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.ch-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid #e4e6ea;
  transition: opacity 0.2s;
  min-height: 66px;
}
.ch-strip.muted {
  opacity: 0.38;
}

/* 타입 태그 */
.ch-tag {
  font-size: 9px;
  font-weight: 800;
  color: #fff;
  letter-spacing: 0.5px;
  padding: 14px 12px;
  border-radius: 3px;
  flex-shrink: 0;
}

.ch-mode {
  font-size: 8px;
  font-weight: 300;
  letter-spacing: 0.5px;
  padding: 1px 4px;
  border-radius: 2px;
  flex-shrink: 0;
  line-height: 1.4;
}
.ch-mode--st {
  background: #e8eaf6;
  color: #3949ab;
}
.ch-mode--mono {
  background: #f5f5f5;
  color: #9e9e9e;
}

/* 이름 + 슬라이더 영역 */
.ch-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.ch-info {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.ch-name {
  font-size: 13px;
  font-weight: 600;
  color: #37474f;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.slider-wrap {
  position: relative;
}

.slider-thumb-tip {
  position: absolute;
  top: -22px;
  transform: translateX(-50%);
  font-size: 10px;
  font-family: 'Courier New', monospace;
  color: #fff;
  background: #1565c0;
  border-radius: 3px;
  padding: 1px 5px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 10;
}

.gain-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 14px;
  background: transparent;
  cursor: pointer;
  margin: 0;
  padding: 0;
}
.gain-slider::-webkit-slider-runnable-track {
  height: 3px;
  background: #cfd8dc;
  border-radius: 2px;
}
.gain-slider::-moz-range-track {
  height: 3px;
  background: #cfd8dc;
  border-radius: 2px;
}
.gain-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #1976d2;
  cursor: pointer;
  margin-top: -5.5px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}
.gain-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #1976d2;
  border: none;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}

.db-val {
  font-size: 12px;
  font-family: 'Courier New', monospace;
  color: #1565c0;
  min-width: 64px;
  text-align: right;
  cursor: pointer;
  flex-shrink: 0;
  padding: 4px 5px;
  border-radius: 3px;
  border: 1px solid transparent;
}
.db-val:hover {
  border-color: #90caf9;
  background: #e3f2fd;
}

.db-input {
  width: 64px;
  font-size: 12px;
  font-family: 'Courier New', monospace;
  color: #1565c0;
  background: #e3f2fd;
  border: 1px solid #1565c0;
  border-radius: 3px;
  padding: 4px 5px;
  outline: none;
  text-align: center;
  flex-shrink: 0;
}

/* EQ 버튼 — flat 아이콘 스타일 */
.eq-btn {
  color: #546e7a;
  background: transparent;
  border: none;
  border-radius: 4px;
  padding: 0 6px;
  height: 32px;
  cursor: pointer;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
.eq-btn:hover {
  background: #eceff1;
  color: #263238;
}

.eq-bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 16px;
}
.eq-bar {
  width: 4px;
  background: currentColor;
  border-radius: 1px;
}
.eq-bar:nth-child(1) {
  height: 7px;
}
.eq-bar:nth-child(2) {
  height: 14px;
}
.eq-bar:nth-child(3) {
  height: 10px;
}

/* 레벨 미터 (vertical) */
.level-meters {
  display: flex;
  gap: 2px;
  align-self: stretch;
  flex-shrink: 0;
  width: 16px;
  padding: 6px 0;
}
.level-meter {
  flex: 1;
  background: #e0e4e8;
  border-radius: 2px;
  position: relative;
  overflow: hidden;
}
.level-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  transition: height 0.12s linear;
}

.body--dark .ch-strip {
  border-color: #2a2a3e;
}
.body--dark .ch-name {
  color: #eceff1;
}
.body--dark .db-val {
  color: #64b5f6;
}
.body--dark .gain-slider::-webkit-slider-runnable-track {
  background: #37474f;
}
.body--dark .gain-slider::-moz-range-track {
  background: #37474f;
}
.body--dark .level-meter {
  background: #2a3f5f;
}
.body--dark .eq-btn {
  border-color: #455a64;
  color: #90a4ae;
}

</style>
