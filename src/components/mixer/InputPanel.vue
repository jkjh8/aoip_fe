<script setup>
import { computed } from 'vue'
import { useChannelPanel } from 'src/composables/useChannelPanel'
import LevelMeter from './LevelMeter.vue'

const props = defineProps({
  sectionTitle: { type: String, default: null },
  allStreams: { type: Array, default: () => [] },
  streamDetails: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['activate-stream', 'remove-stream', 'edit-stream', 'stop-stream'])

const {
  channelSections,
  groupKey,
  groupTag,
  groupLabel,
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
} = useChannelPanel('input')

const displaySections = computed(() =>
  props.sectionTitle
    ? channelSections.value.filter((s) => s.title === props.sectionTitle)
    : channelSections.value,
)

const sectionColor = computed(() => displaySections.value[0]?.color ?? '#546e7a')
</script>

<template>
  <q-card style="background-color: #fff; width: 100%">
    <q-card-section class="card-header" :style="`border-top: 3px solid ${sectionColor}`">
      <span class="card-title">{{ sectionTitle ?? 'Inputs' }}</span>
      <span class="card-dir">Input</span>
      <q-btn v-if="sectionTitle === 'Stream'" flat dense round size="xs" icon="add" color="deep-orange-7" class="q-ml-auto">
        <q-tooltip>스트림 관리</q-tooltip>
        <q-menu>
          <q-list style="min-width: 260px">
            <q-item-label header class="text-caption q-py-xs">Input 스트림</q-item-label>
            <template v-if="allStreams.length">
              <q-item v-for="s in allStreams" :key="s.client" dense>
                <q-item-section avatar style="min-width:24px; padding-right:0">
                  <q-badge :color="s.running ? 'positive' : 'grey-5'" rounded />
                </q-item-section>
                <q-item-section>{{ streamDetails[s.client]?.name ?? s.client }}</q-item-section>
                <q-item-section side>
                  <div class="row no-wrap">
                    <q-btn v-if="!s.running" flat round dense size="xs" icon="play_circle" color="positive"
                      v-close-popup @click="emit('activate-stream', s)">
                      <q-tooltip>시작</q-tooltip>
                    </q-btn>
                    <template v-else>
                      <q-btn flat round dense size="xs" icon="edit" color="grey-6"
                        v-close-popup @click="emit('edit-stream', s)">
                        <q-tooltip>설정 수정</q-tooltip>
                      </q-btn>
                      <q-btn flat round dense size="xs" icon="stop_circle" color="negative"
                        v-close-popup @click="emit('stop-stream', s)">
                        <q-tooltip>중지</q-tooltip>
                      </q-btn>
                    </template>
                    <q-btn flat round dense size="xs" icon="delete_outline" color="grey-5"
                      v-close-popup @click.stop="emit('remove-stream', s.client)">
                      <q-tooltip>삭제</q-tooltip>
                    </q-btn>
                  </div>
                </q-item-section>
              </q-item>
            </template>
            <q-item v-else disable dense>
              <q-item-section class="text-grey-5 text-caption">스트림 없음</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </q-card-section>
    <q-separator />
    <q-card-section>
      <template v-for="section in displaySections" :key="section.title">
        <template v-for="group in section.groups" :key="groupKey(group)">
          <div class="ch-strip" :class="{ muted: isMuted(group) }">
            <span class="ch-tag" :style="`background:${groupTag(group).color}`">
              {{ groupTag(group).text }}
            </span>
            <div class="route-spacer q-mr-md" />

            <div class="ch-main">
              <div class="ch-info">
                <span class="ch-name">{{ groupLabel(group) }}</span>
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

            <input
              v-if="editingId === groupKey(group)"
              :ref="(el) => { if (el) inputRefs[groupKey(group)] = el }"
              v-model="editingVal"
              class="db-input"
              @blur="commitEdit(group)"
              @keydown="onEditKeydown($event, group)"
            />
            <span v-else class="db-val" @click="onDbClick(group)">{{ toDb(groupGain(group)) }}</span>

            <q-btn
              class="mute-btn"
              flat dense size="md"
              :icon="isMuted(group) ? 'volume_off' : 'volume_up'"
              :color="isMuted(group) ? 'negative' : 'blue-grey-5'"
              @click="doToggleMute(group)"
            >
              <q-tooltip class="bg-grey-4 text-grey-9" anchor="top middle" self="bottom middle" :offset="[0, 4]">
                Mute
              </q-tooltip>
            </q-btn>
            <LevelMeter
              :channels="
                group.stereo
                  ? [
                      { level: group.left.level, muted: isMuted(group), label: 'L' },
                      { level: group.right.level, muted: isMuted(group), label: 'R' },
                    ]
                  : [{ level: group.ch.level, muted: isMuted(group) }]
              "
              :title="groupLabel(group)"
            />
          </div>
        </template>
      </template>
    </q-card-section>
  </q-card>
</template>

<style scoped>
.route-spacer {
  width: 44px;
  height: 40px;
  flex-shrink: 0;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 10px;
  padding-bottom: 10px;
}
.card-title {
  font-size: 15px;
  font-weight: 500;
}
.card-dir {
  font-size: 11px;
  color: #90a4ae;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.strip-actions {
  display: flex;
  gap: 2px;
}
.stream-list-row {
  display: flex;
  align-items: center;
}
</style>
