<script setup>
import { useChannelPanel } from 'src/composables/useChannelPanel'
import EqPanel from './EqPanel.vue'
import LevelMeter from './LevelMeter.vue'

const {
  channelGroups,
  groupKey,
  groupTag,
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
} = useChannelPanel('input')
</script>

<template>
  <q-card style="background-color: #fff">
    <q-card-section>
      <div class="text-h6 text-weight-light">Inputs</div>
    </q-card-section>
    <q-separator />
    <q-card-section>
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
            >
              EQ
            </q-tooltip>
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
    </q-card-section>
  </q-card>

  <EqPanel
    v-model="eqOpen"
    :channel="eqChannel"
    :channel-right="eqChannelRight"
    channel-type="input"
  />
</template>

<style scoped>
/* InputPanel 고유 스타일 없음 — 공통 클래스는 src/css/app.scss 참조 */
</style>
