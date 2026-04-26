<script setup>
import { computed, ref } from 'vue'
import { useAoipStore } from 'src/stores/aoip'
import { useChannelPanel } from 'src/composables/useChannelPanel'
import EqPanel from './EqPanel.vue'
import LevelMeter from './LevelMeter.vue'
import LimiterPanel from './LimiterPanel.vue'
import RoutingDialog from './RoutingDialog.vue'

const aoipState = useAoipStore()

const {
  channelGroups,
  groupKey,
  groupTag,
  typeTag,
  stereoLabel,
  isMuted,
  doToggleMute,
  groupGain,
  dragging,
  sliderVal,
  onSliderInput,
  thumbLeft,
  fmtSlider,
  onSliderChange,
  editingId,
  inputRefs,
  editingVal,
  commitEdit,
  onEditKeydown,
  toDb,
  onDbClick,
  hasDsp,
  isEqActive,
  openEq,
  eqOpen,
  eqChannel,
  eqChannelRight,
} = useChannelPanel('output')

// Limiter (output only)
const limOpen = ref(false)
const limChannel = ref(null)
const limChannelRight = ref(null)

function openLimiter(group) {
  limChannel.value = group.stereo ? group.left : group.ch
  limChannelRight.value = group.stereo ? group.right : null
  limOpen.value = true
}

function isLimiterActive(group) {
  const ch = group.stereo ? group.left : group.ch
  return ch?.dsp?.limiter?.enabled === true
}

// Routing (output only)
const routeTarget = ref(null)

const routeDialogOpen = computed({
  get: () => routeTarget.value !== null,
  set: (v) => {
    if (!v) routeTarget.value = null
  },
})

function isConnected(inputPort, outputPort) {
  const entry = aoipState.connections.find((c) => c.port === inputPort)
  return entry ? entry.connections.includes(outputPort) : false
}

function allDots(outGroup) {
  const port = outGroup.stereo ? outGroup.left.jackPort : outGroup.ch.jackPort
  return aoipState.filteredInputs.map((ch) => ({
    port: ch.jackPort,
    color: isConnected(ch.jackPort, port) ? typeTag(ch.label).color : '#d0d0d0',
    connected: isConnected(ch.jackPort, port),
  }))
}
</script>

<template>
  <q-card class="ch-panel">
    <q-card-section>
      <div class="text-h6 text-weight-light">Ouputs</div>
    </q-card-section>
    <q-separator />
    <q-card-section>
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
            :channels="
              group.stereo
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
    </q-card-section>
  </q-card>
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
