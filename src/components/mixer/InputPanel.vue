<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAoipStore } from 'src/stores/aoip'
import { useChannelPanel } from 'src/composables/useChannelPanel'
import LevelMeter from './LevelMeter.vue'
import InputDspDialog from './InputDspDialog.vue'

const aoipStore = useAoipStore()
const { t } = useI18n()

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
} = useChannelPanel('input')

const displaySections = computed(() =>
  props.sectionTitle
    ? channelSections.value.filter((s) => s.title === props.sectionTitle)
    : channelSections.value,
)

const sectionColor = computed(() => displaySections.value[0]?.color ?? '#546e7a')

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
const dspChannel      = computed(() => aoipStore.channels.inputs.find(c => c.id === dspTargetId.value) ?? null)
const dspChannelRight = computed(() => aoipStore.channels.inputs.find(c => c.id === dspTargetRightId.value) ?? null)

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
  <q-card style="background-color: #fff; width: 100%">
    <q-card-section class="card-header" :style="`border-top: 3px solid ${sectionColor}`">
      <span class="card-title">{{ sectionTitle ?? t('mixer.inputs') }}</span>
      <span class="card-dir">{{ t('mixer.input') }}</span>
      <q-btn v-if="sectionTitle === 'Stream'" flat dense round size="xs" icon="add" color="deep-orange-7" class="q-ml-auto">
        <q-tooltip>{{ t('mixer.manageStreams') }}</q-tooltip>
        <q-menu>
          <q-list style="min-width: 260px">
            <q-item-label header class="text-caption q-py-xs">{{ t('mixer.inputStreams') }}</q-item-label>
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
                <span class="dchip" :class="dspChipClass(group, 'hpf')">HPF</span>
                <span class="dchip" :class="dspEqClass(group)">EQ</span>
                <span class="dchip" :class="dspChipClass(group, 'gate')">GATE</span>
                <span class="dchip" :class="dspChipClass(group, 'comp')">COMP</span>
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
    </q-card-section>

    <InputDspDialog
      v-model="dspOpen"
      :channel="dspChannel"
      :channel-right="dspChannelRight"
      :mirrored="dspMirrored"
    />
  </q-card>
</template>

<style scoped>
.ch-strip--no-bottom { border-bottom: none !important; }
.ch-strip--slave { opacity: 0.45; }
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
