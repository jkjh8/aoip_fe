<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAoipStore } from 'src/stores/aoip'
import { useChannelPanel } from 'src/composables/useChannelPanel'
import LevelMeter from './LevelMeter.vue'
import RoutingDialog from './RoutingDialog.vue'
import OutputDspDialog from './OutputDspDialog.vue'
import 'src/css/channel-panel.css'

const aoipState = useAoipStore()
const { t } = useI18n()

const props = defineProps({
  sectionTitle: { type: String, default: null },
  allStreams: { type: Array, default: () => [] },
  streamDetails: { type: Object, default: () => ({}) },
})

// const emit = defineEmits(['activate-stream', 'remove-stream', 'edit-stream', 'stop-stream'])

const {
  channelSections,
  channelGroups,
  groupKey,
  groupTag,
  groupLabel,
  getChannelType,
  typeTag,
  isMuted,
  doToggleMute,
  dragging,
  sliderVal,
  onSliderInput,
  fmtSlider,
  onSliderChange,
  editingId,
  inputRefs,
  editingVal,
  commitEdit,
  onEditKeydown,
  onDbClick,
  toggleAnalogLink,
} = useChannelPanel('output')

const displaySections = computed(() =>
  props.sectionTitle
    ? channelSections.value.filter((s) => s.title === props.sectionTitle)
    : channelSections.value,
)

const sectionColor = computed(() => displaySections.value[0]?.color ?? '#546e7a')

const routeTarget = ref(null)
const routeDialogOpen = computed({
  get: () => routeTarget.value !== null,
  set: (v) => {
    if (!v) routeTarget.value = null
  },
})

function openRoute(group) {
  if (group.linked && !group.pairFirst) {
    const master = channelGroups.value.find((g) => g.pairFirst && g.pairId === group.pairId)
    routeTarget.value = master ?? group
  } else {
    routeTarget.value = group
  }
}

const dspTargetId = ref(null)
const dspTargetRightId = ref(null)
const dspMirrored = ref(false)
const dspOpen = ref(false)

function openDsp(group) {
  dspTargetId.value = group.stereo ? group.left.id : group.ch.id
  dspTargetRightId.value = group.stereo
    ? group.right.id
    : group.linked && group.partner
      ? group.partner.id
      : null
  dspMirrored.value = !group.stereo && !!group.linked
  dspOpen.value = true
}

const dspChannel = computed(
  () => aoipState.channels.outputs.find((c) => c.id === dspTargetId.value) ?? null,
)
const dspChannelRight = computed(
  () => aoipState.channels.outputs.find((c) => c.id === dspTargetRightId.value) ?? null,
)

function isConnected(inputPort, outputPort) {
  const entry = aoipState.connections.find((c) => c.port === inputPort)
  return entry ? entry.connections.includes(outputPort) : false
}

const TYPE_ORDER = ['analog', 'usb', 'stream', 'aes67', 'other']
const TYPE_COLS = { analog: 4, usb: 4, stream: 4, aes67: 4, other: 4 }

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
  return TYPE_ORDER.filter((t) => byType[t]?.length).map((t) => ({
    type: t,
    cols: TYPE_COLS[t],
    dots: byType[t],
  }))
}

function hasConnected(outGroup) {
  return dotGroups(outGroup).some((g) => g.dots.some((d) => d.connected))
}

function mainCh(group) {
  return group.stereo ? group.left : group.ch
}
function dspEqClass(group) {
  const dsp = mainCh(group)?.dsp
  if (dsp?.eqBypass) return 'dchip--warn'
  return dsp?.eq?.some((b) => b.enabled) ? 'dchip--on' : ''
}
function dspEnabled(group) {
  return mainCh(group)?.dspEnabled === true
}
</script>

<template>
  <q-card style="width: 100%">
    <q-card-section
      class="row no-wrap justify-between"
      :style="`border-top: 3px solid ${sectionColor}`"
      style="min-width: 113px"
    >
      <div class="q-gutter-x-sm">
        <span class="card-title">{{ sectionTitle ?? t('mixer.outputs') }}</span>
        <span class="card-dir">{{ t('mixer.output') }}</span>
      </div>
      <div v-if="sectionTitle === 'Analog'" class="row items-center q-gutter-x-xs">
        <template
          v-for="group in displaySections[0]?.groups?.filter((g) => g.pairFirst)"
          :key="groupKey(group)"
        >
          <q-btn
            class="v-link-btn"
            :class="{ 'v-link-btn--linked': group.linked }"
            unelevated
            @click="toggleAnalogLink(group)"
          >
            <q-icon :name="group.linked ? 'link' : 'link_off'" size="10px" />
            <q-tooltip>{{ group.linked ? t('mixer.linked') : t('mixer.link') }}</q-tooltip>
          </q-btn>
        </template>
      </div>
    </q-card-section>
    <q-separator />

    <q-card-section class="q-pa-sm row no-wrap justify-center">
      <div class="v-strips-wrap q-gutter-x-sm">
        <template v-for="section in displaySections" :key="section.title">
          <template v-for="(group, index) in section.groups" :key="groupKey(group)">
            <div
              class="v-strip"
              :class="{
                'v-strip--muted': isMuted(group),
                'v-strip--slave': group.linked && !group.pairFirst,
              }"
            >
              <!-- 채널 타입 뱃지 -->
              <div class="v-tag" :style="`background:${groupTag(group).color}`">
                {{ groupTag(group).text }}
              </div>

              <!-- 채널명 -->
              <div class="v-ch-name">{{ groupLabel(group) }}</div>

              <!-- 스테레오/모노 뱃지 -->
              <div class="v-mode" :class="group.stereo ? 'v-mode--st' : 'v-mode--mono'">
                {{ group.stereo ? 'STEREO' : 'MONO' }}
              </div>
              <!-- 라우팅 버튼 -->
              <q-btn
                unelevated
                size="xs"
                :color="hasConnected(group) ? 'primary' : 'grey'"
                @click="openRoute(group)"
              >
                Route
                <q-tooltip>{{
                  hasConnected(group) ? t('common.edit') : t('common.add')
                }}</q-tooltip>
              </q-btn>

              <!-- DSP 버튼 (활성화된 경우만) -->
              <div v-if="dspEnabled(group)" class="v-dsp-bar" @click="openDsp(group)">
                <span class="v-dchip" :class="dspEqClass(group)">EQ</span>
                <span class="v-dchip" :class="mainCh(group)?.dsp?.gate?.enabled ? 'dchip--on' : ''"
                  >GATE</span
                >
                <span class="v-dchip" :class="mainCh(group)?.dsp?.comp?.enabled ? 'dchip--on' : ''"
                  >COMP</span
                >
                <span
                  class="v-dchip"
                  :class="
                    mainCh(group)?.dsp?.lim?.enabled || mainCh(group)?.dsp?.limiter?.enabled
                      ? 'dchip--on'
                      : ''
                  "
                  >LIM</span
                >
                <span
                  v-if="mainCh(group)?.dsp?.lim?.enabled || mainCh(group)?.dsp?.limiter?.enabled"
                  class="v-dchip dchip--on"
                  >LIM</span
                >
              </div>
              <div v-else class="v-dsp-placeholder" />

              <!-- Fader + Level Meter 영역 -->
              <div class="v-fader-area">
                <div class="v-fader-col">
                  <div v-if="dragging[groupKey(group)] !== undefined" class="v-thumb-tip">
                    {{ fmtSlider(sliderVal(group)) }}
                  </div>
                  <q-slider
                    :model-value="sliderVal(group)"
                    :min="-60"
                    :max="12"
                    :step="0.5"
                    vertical
                    reverse
                    color="primary"
                    class="v-fader"
                    @update:model-value="onSliderInput(group, $event)"
                    @change="onSliderChange(group, $event)"
                  />
                </div>
                <LevelMeter
                  :channels="
                    group.stereo
                      ? [
                          {
                            level: group.left?.level ?? -Infinity,
                            muted: isMuted(group),
                            label: 'L',
                          },
                          {
                            level: group.right?.level ?? -Infinity,
                            muted: isMuted(group),
                            label: 'R',
                          },
                        ]
                      : [{ level: group.ch?.level ?? -Infinity, muted: isMuted(group) }]
                  "
                  :title="groupLabel(group)"
                />
              </div>

              <!-- dB 값 표시 -->
              <input
                v-if="editingId === groupKey(group)"
                :ref="
                  (el) => {
                    if (el) inputRefs[groupKey(group)] = el
                  }
                "
                v-model="editingVal"
                class="v-db-input"
                @blur="commitEdit(group)"
                @keydown="onEditKeydown($event, group)"
              />
              <span v-else class="v-db-val" @click="onDbClick(group)">
                {{ fmtSlider(sliderVal(group)) }}
              </span>

              <!-- Mute 버튼 -->
              <q-btn
                flat
                dense
                size="sm"
                :icon="isMuted(group) ? 'volume_off' : 'volume_up'"
                :color="isMuted(group) ? 'negative' : 'blue-grey-4'"
                class="v-mute-btn"
                @click="doToggleMute(group)"
              >
                <q-tooltip>{{ t('common.mute') }}</q-tooltip>
              </q-btn>
            </div>

            <q-separator vertical v-if="index < section.groups.length - 1" />
          </template>
        </template>
      </div>
    </q-card-section>

    <RoutingDialog v-model="routeDialogOpen" :route-target="routeTarget" />
    <OutputDspDialog
      v-model="dspOpen"
      :channel="dspChannel"
      :channel-right="dspChannelRight"
      :mirrored="dspMirrored"
    />
  </q-card>
</template>

<style scoped></style>
