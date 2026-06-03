<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAoipStore } from 'src/stores/aoip'
import { useChannelPanel } from 'src/composables/useChannelPanel'
import LevelMeter from './LevelMeter.vue'
import RoutingDialog from './RoutingDialog.vue'
import OutputDspDialog from './OutputDspDialog.vue'

const props = defineProps({
  sectionTitle: { type: String, default: null },
  allStreams: { type: Array, default: () => [] },
  streamDetails: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['activate-stream', 'remove-stream', 'edit-stream', 'stop-stream'])

const aoipState = useAoipStore()
const { t } = useI18n()

const {
  channelSections,
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
  thumbLeft,
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
  set: (v) => { if (!v) routeTarget.value = null },
})

const dspTargetId      = ref(null)
const dspTargetRightId = ref(null)
const dspMirrored = ref(false)
const dspOpen = ref(false)
function openDsp(group) {
  dspTargetId.value      = group.stereo ? group.left.id : group.ch.id
  // Stream pairs do explicit dual emit; I2S analog stereo is mirrored by the backend
  // but still needs the partner channel for the stereo level meter.
  dspTargetRightId.value = group.stereo
    ? group.right.id
    : (group.linked && group.partner ? group.partner.id : null)
  dspMirrored.value = !group.stereo && !!group.linked
  dspOpen.value = true
}
const dspChannel      = computed(() => aoipState.channels.outputs.find(c => c.id === dspTargetId.value) ?? null)
const dspChannelRight = computed(() => aoipState.channels.outputs.find(c => c.id === dspTargetRightId.value) ?? null)

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
  return dotGroups(outGroup).some((g) => g.dots.some((d) => d.connected))
}

function mainCh(group) { return group.stereo ? group.left : group.ch }
function dspEqClass(group) {
  const dsp = mainCh(group)?.dsp
  if (dsp?.eqBypass) return 'dchip--warn'
  return dsp?.eq?.some(b => b.enabled) ? 'dchip--on' : ''
}
function dspChipClass(group, ...keys) {
  const dsp = mainCh(group)?.dsp
  for (const k of keys) { if (dsp?.[k]?.enabled) return 'dchip--on' }
  return ''
}
</script>

<template>
  <q-card class="ch-panel" style="width: 100%">
    <q-card-section class="card-header" :style="`border-top: 3px solid ${sectionColor}`">
      <span class="card-title">{{ sectionTitle ?? t('mixer.outputs') }}</span>
      <span class="card-dir">{{ t('mixer.output') }}</span>
      <q-btn v-if="sectionTitle === 'Stream'" flat dense round size="xs" icon="add" color="blue-7" class="q-ml-auto">
        <q-tooltip>{{ t('mixer.manageStreams') }}</q-tooltip>
        <q-menu>
          <q-list style="min-width: 260px">
            <q-item-label header class="text-caption q-py-xs">{{ t('mixer.outputStreams') }}</q-item-label>
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
                      <q-tooltip>{{ t('common.start') }}</q-tooltip>
                    </q-btn>
                    <template v-else>
                      <q-btn flat round dense size="xs" icon="edit" color="grey-6"
                        v-close-popup @click="emit('edit-stream', s)">
                        <q-tooltip>{{ t('mixer.editConfig') }}</q-tooltip>
                      </q-btn>
                      <q-btn flat round dense size="xs" icon="stop_circle" color="negative"
                        v-close-popup @click="emit('stop-stream', s)">
                        <q-tooltip>{{ t('common.stop') }}</q-tooltip>
                      </q-btn>
                    </template>
                    <q-btn flat round dense size="xs" icon="delete_outline" color="grey-5"
                      v-close-popup @click.stop="emit('remove-stream', s.client)">
                      <q-tooltip>{{ t('common.delete') }}</q-tooltip>
                    </q-btn>
                  </div>
                </q-item-section>
              </q-item>
            </template>
            <q-item v-else disable dense>
              <q-item-section class="text-grey-5 text-caption">{{ t('mixer.noStreams') }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </q-card-section>
    <q-separator />
    <q-card-section>
      <template v-for="section in displaySections" :key="section.title">
        <template v-for="group in section.groups" :key="groupKey(group)">
          <div
            class="ch-strip"
            :class="{
              muted: isMuted(group),
              'ch-strip--slave': group.linked && !group.pairFirst,
              'ch-strip--no-bottom': group.pairFirst,
            }"
          >
            <span class="ch-tag" :style="`background:${groupTag(group).color}`">
              {{ groupTag(group).text }}
            </span>

            <button
              class="route-btn q-mr-md"
              :class="{ 'route-btn--active': hasConnected(group) }"
              title="Routing"
              @click="routeTarget = group"
            >
              <span
                v-for="dg in dotGroups(group)"
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
                <span class="ch-name">{{ groupLabel(group) }}</span>
                <span class="ch-mode" :class="group.stereo ? 'ch-mode--st' : 'ch-mode--mono'">
                  {{ group.stereo ? t('common.stereo') : t('common.mono') }}
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
              <div v-if="groupTag(group).text !== 'STR'" class="dsp-bar" @click="openDsp(group)">
                <span class="dchip" :class="dspEqClass(group)">EQ</span>
                <span class="dchip" :class="dspChipClass(group, 'gate')">GATE</span>
                <span class="dchip" :class="dspChipClass(group, 'comp')">COMP</span>
                <span class="dchip" :class="dspChipClass(group, 'lim', 'limiter')">LIM</span>
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
            <span v-else class="db-val" @click="onDbClick(group)">{{ fmtSlider(sliderVal(group)) }}</span>

            <q-btn
              class="mute-btn"
              flat dense size="md"
              :icon="isMuted(group) ? 'volume_off' : 'volume_up'"
              :color="isMuted(group) ? 'negative' : 'blue-grey-5'"
              @click="doToggleMute(group)"
            >
              <q-tooltip class="bg-grey-4 text-grey-9" anchor="top middle" self="bottom middle" :offset="[0, 4]">
                {{ t('common.mute') }}
              </q-tooltip>
            </q-btn>
            <LevelMeter
              :channels="
                group.stereo
                  ? [
                      { level: group.left?.level ?? -Infinity, muted: isMuted(group), label: 'L' },
                      { level: group.right?.level ?? -Infinity, muted: isMuted(group), label: 'R' },
                    ]
                  : [{ level: group.ch?.level ?? -Infinity, muted: isMuted(group) }]
              "
              :title="groupLabel(group)"
            />
          </div>
          <div v-if="group.pairFirst" class="link-connector">
            <button
              class="link-btn"
              :class="{ 'link-btn--linked': group.linked }"
              @click="toggleAnalogLink(group)"
            >
              <q-icon :name="group.linked ? 'link' : 'link_off'" size="11px" />
              <span>{{ group.linked ? t('mixer.linked') : t('mixer.link') }}</span>
            </button>
          </div>
        </template>
      </template>

      <RoutingDialog v-model="routeDialogOpen" :route-target="routeTarget" />
      <OutputDspDialog
        v-model="dspOpen"
        :channel="dspChannel"
        :channel-right="dspChannelRight"
        :mirrored="dspMirrored"
      />
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
  padding: 3px;
  overflow: hidden;
}
.route-btn--active {
  border-color: #90caf9;
  background: #e3f2fd;
}
.ch-strip--no-bottom { border-bottom: none !important; }
.ch-strip--slave > *:not(.route-btn) { opacity: 0.45; }
.link-connector {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 1px;
  background: #e4e6ea;
  margin: 0;
}
.link-btn {
  background: #f5f7fa;
  border: 1px solid #b0bec5;
  border-radius: 3px;
  padding: 1px 5px;
  cursor: pointer;
  font-size: 9px;
  font-weight: 600;
  color: #78909c;
  display: flex;
  align-items: center;
  gap: 2px;
  line-height: 1;
  white-space: nowrap;
  letter-spacing: 0.04em;
}
.link-btn:hover { background: #e3f2fd; border-color: #90caf9; color: #1976d2; }
.link-btn--linked { background: #e3f2fd; border-color: #90caf9; color: #1565c0; font-weight: 700; }
.link-btn--linked:hover { background: #ffebee; border-color: #ef9a9a; color: #c62828; }
.dsp-bar { display: flex; gap: 2px; cursor: pointer; padding: 3px 0 1px; flex-shrink: 0; }
.dchip {
  font-size: 7px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;
  padding: 1px 4px; border-radius: 2px; border: 1px solid #d0d8e0;
  background: #f5f7fa; color: #90a4ae; transition: all 0.1s;
}
.dsp-bar:hover .dchip { border-color: #90a4ae; color: #546e7a; }
.dchip--on { background: #e8f5e9; border-color: #81c78455; color: #388e3c; }
.dchip--warn { background: #fff3e0; border-color: #f57c0055; color: #e65100; }
.item-action {
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;
}
.ch-strip:hover .item-action {
  opacity: 1;
}

.route-dots {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  /* width는 타입별로 인라인 바인딩 */
}
.route-dot {
  width: 5px;
  height: 5px;
  border-radius: 1px;
  flex-shrink: 0;
}
</style>
