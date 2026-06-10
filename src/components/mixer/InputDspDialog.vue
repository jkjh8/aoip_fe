<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { socket } from 'src/boot/socket'
import { useAoipStore } from 'src/stores/aoip'

const { t } = useI18n()
const aoipStore = useAoipStore()
import 'src/css/dsp-dialog.css'
import EqPanel from './dsp/EqPanel.vue'
import GateTab from './dsp/GateTab.vue'
import CompTab from './dsp/CompTab.vue'
import LevelVolPanel from './LevelVolPanel.vue'

const props = defineProps({
  modelValue: Boolean,
  channel: Object,
  channelRight: Object,
  // When true, the backend mirrors DSP changes between channel and channelRight,
  // so the dialog should only emit to one channel (the meter still shows both).
  mirrored: Boolean,
})
const emit = defineEmits(['update:modelValue'])

// ── Stereo link ──────────────────────────────────────────────
const linked = ref(true)
const chR = computed(() =>
  !props.mirrored && linked.value ? props.channelRight : null,
)

// ── Component refs ───────────────────────────────────────────
const eqRef = ref(null)
const gateRef = ref(null)
const compRef = ref(null)
const levelRef = ref(null)

// ── Proc-sum ─────────────────────────────────────────────────
const eqBypass = computed(() => props.channel?.dsp?.eqBypass ?? false)
const eqEnabledCount = computed(() => props.channel?.dsp?.eq?.filter((b) => b.enabled)?.length ?? 0)
const gateEnabled = computed(() => gateRef.value?.enabled ?? false)
const compEnabled = computed(() => compRef.value?.enabled ?? false)

// ── HPF ──────────────────────────────────────────────────────
const hpfEnabled = computed(() => eqRef.value?.hpfEnabled ?? false)
const hpfFreq = computed(() => props.channel?.dsp?.hpf?.fc ?? props.channel?.dsp?.hpf?.freq ?? 80)
const hpfSlope = computed(() => props.channel?.dsp?.hpf?.slope ?? 12)
const hpfFreqLocal = ref(80)
const hpfSlopeLocal = ref(12)
watch(
  hpfFreq,
  (v) => {
    hpfFreqLocal.value = v
  },
  { immediate: true },
)
watch(
  hpfSlope,
  (v) => {
    hpfSlopeLocal.value = v
  },
  { immediate: true },
)
function hpfToggle() {
  eqRef.value?.toggleHpf?.()
}
function hpfSetFreq(val) {
  const n = parseFloat(val)
  eqRef.value?.setHpfFreq?.(Math.max(20, Math.min(20000, isFinite(n) ? Math.round(n) : 80)))
}
function hpfSetSlope(val) {
  eqRef.value?.setHpfSlope?.(Number(val))
}

// ── Tab ──────────────────────────────────────────────────────
const activeTab = ref('eq')

// ── GR ───────────────────────────────────────────────────────
const gateGrDb = computed(() =>
  aoipStore.gr.inputs.find((e) => e.ch === props.channel?.id)?.gate ?? 0,
)
const compGrDb = computed(() =>
  aoipStore.gr.inputs.find((e) => e.ch === props.channel?.id)?.comp ?? 0,
)

// ── Trim ─────────────────────────────────────────────────────
const trimDb = ref(0)
function sendTrim() {
  if (!props.channel) return
  const ids = [props.channel.id, chR.value?.id].filter(Boolean)
  for (const id of ids) socket.emit('dsp:trim', { type: 'input', id, db: trimDb.value })
}

function initFromChannel() {
  if (!props.channel) return
  trimDb.value = props.channel.dsp?.trim ?? 0
  levelRef.value?.init()
}

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      initFromChannel()
      socket.emit('dsp:gr:enable')
    } else {
      socket.emit('dsp:gr:disable')
    }
  },
)
watch(
  () => props.channel?.id,
  () => initFromChannel(),
)

</script>

<template>
  <q-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <q-card class="dsp-card">
      <!-- Header -->
      <div class="dsp-hd">
        <q-icon name="tune" size="18px" style="color: #5a6a8a" />
        <span class="dsp-hd-title">{{ t('mixer.inputDsp') }}</span>
        <span class="dsp-hd-ch">{{ channel?.label }}</span>
        <template v-if="channelRight">
          <span class="dsp-hd-sep">·</span>
          <span class="dsp-hd-ch dsp-hd-ch--r">{{ channelRight?.label }}</span>
          <q-btn
            v-if="!mirrored"
            :icon="linked ? 'link' : 'link_off'"
            :color="linked ? 'primary' : 'blue-grey-4'"
            flat
            dense
            size="sm"
            padding="3px 5px"
            @click="linked = !linked"
          />
        </template>
        <q-space />
        <q-btn
          flat
          round
          dense
          icon="close"
          size="sm"
          color="blue-grey-5"
          @click="emit('update:modelValue', false)"
        />
      </div>

      <!-- Proc-sum -->
      <div class="proc-sum">
        <q-btn
          no-caps
          unelevated
          padding="5px 10px"
          class="pchip"
          :class="{ 'pchip--cur': activeTab === 'eq' }"
          @click="activeTab = 'eq'"
        >
          <div
            class="pled"
            :class="eqBypass ? 'pled--warn' : eqEnabledCount > 0 ? 'pled--ok' : 'pled--off'"
          />
          <span class="pname">EQ</span>
        </q-btn>
        <q-btn
          no-caps
          unelevated
          padding="5px 10px"
          class="pchip"
          :class="{ 'pchip--cur': activeTab === 'gate' }"
          @click="activeTab = 'gate'"
        >
          <div class="pled" :class="gateEnabled ? 'pled--ok' : 'pled--off'" />
          <span class="pname">GATE</span>
        </q-btn>
        <q-btn
          no-caps
          unelevated
          padding="5px 10px"
          class="pchip"
          :class="{ 'pchip--cur': activeTab === 'comp' }"
          @click="activeTab = 'comp'"
        >
          <div class="pled" :class="compEnabled ? 'pled--ok' : 'pled--off'" />
          <span class="pname">COMP</span>
        </q-btn>
      </div>

      <!-- Body -->
      <div class="dsp-body">
        <!-- LEFT: TRIM + HPF -->
        <div class="side-col">
          <div class="side-block">
            <div class="blk-hdr">{{ t('mixer.trim') }}</div>
            <div class="trim-vert">
              <q-slider
                :model-value="Number.isFinite(trimDb) ? trimDb : 0"
                :min="-20"
                :max="20"
                :step="0.5"
                vertical
                reverse
                color="blue-8"
                @update:model-value="
                  (v) => {
                    trimDb = v
                    sendTrim()
                  }
                "
                @wheel.prevent="
                  ((trimDb = Math.max(
                    -20,
                    Math.min(
                      20,
                      (Number.isFinite(trimDb) ? trimDb : 0) + ($event.deltaY < 0 ? 1 : -1) * 0.5,
                    ),
                  )),
                  sendTrim())
                "
              />
              <q-input
                v-model.number="trimDb"
                type="number"
                dense
                outlined
                suffix="dB"
                class="side-num-inp"
                @blur="
                  ((trimDb = Math.max(-20, Math.min(20, isFinite(trimDb) ? trimDb : 0))),
                  sendTrim())
                "
                @keydown.enter.prevent="
                  ((trimDb = Math.max(-20, Math.min(20, isFinite(trimDb) ? trimDb : 0))),
                  sendTrim())
                "
              />
            </div>
          </div>
          <div class="side-block side-block--sep">
            <div class="blk-hdr hpf-hdr">{{ t('mixer.hpf') }}</div>
            <div class="hpf-vert">
              <div class="hpf-toggle-row">
                <q-toggle
                  :model-value="hpfEnabled"
                  dense
                  size="md"
                  color="red-6"
                  class="q-ml-md"
                  @update:model-value="hpfToggle"
                />
                <span class="toggle-lbl" :class="hpfEnabled ? 'on-r' : 'off'">{{
                  hpfEnabled ? t('common.on') : t('common.off')
                }}</span>
              </div>
              <div class="blk-hdr q-mt-sm">{{ t('mixer.frequency') }}</div>
              <q-input
                v-model.number="hpfFreqLocal"
                type="number"
                dense
                outlined
                suffix="Hz"
                class="side-num-inp"
                @blur="hpfSetFreq(hpfFreqLocal)"
                @keydown.enter.prevent="hpfSetFreq(hpfFreqLocal)"
              />
              <div class="blk-hdr q-mt-sm">{{ t('mixer.slopePerOct') }}</div>
              <q-select
                :model-value="hpfSlopeLocal"
                :options="[
                  { label: '12', value: 12 },
                  { label: '24', value: 24 },
                  { label: '48', value: 48 },
                ]"
                emit-value
                map-options
                dense
                outlined
                class="side-num-inp"
                @update:model-value="
                  (v) => {
                    hpfSlopeLocal = v
                    hpfSetSlope(v)
                  }
                "
              />
            </div>
          </div>
        </div>

        <!-- CENTER: Tab content -->
        <div class="center-col">
          <EqPanel
            ref="eqRef"
            v-show="activeTab === 'eq'"
            :channel="channel"
            :channel-right="chR"
            channel-type="input"
            :has-hpf="true"
            clip-id="idsp-clip"
          />
          <GateTab
            ref="gateRef"
            v-show="activeTab === 'gate'"
            :channel="channel"
            :channel-right="chR"
            :gr-db="gateGrDb"
          />
          <CompTab
            ref="compRef"
            v-show="activeTab === 'comp'"
            :channel="channel"
            :channel-right="chR"
            channel-type="input"
            :gr-db="compGrDb"
          />
        </div>

        <!-- RIGHT: Level + Vol -->
        <LevelVolPanel
          ref="levelRef"
          :channel="channel"
          :channel-right="channelRight"
          channel-type="input"
        />
      </div>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.dsp-card {
  background: #f4f6fb;
  border-radius: 10px;
  width: 1170px;
  height: 810px;
  max-width: 98vw;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(30, 50, 100, 0.18);
}
.pled--warn {
  background: #f57c00;
  box-shadow: 0 0 5px #f57c0099;
}
.side-col {
  width: 120px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #eef1f8;
  border-right: 1px solid #d0d8e8;
  overflow-y: auto;
}
.side-block {
  padding: 14px 14px 16px;
}
.side-block--sep {
  border-top: 1px solid #d0d8e8;
}
.blk-hdr {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.6px;
  color: #5a6a8a;
  text-transform: uppercase;
  margin-bottom: 10px;
}
.hpf-hdr {
  color: #e53935;
}
.hpf-vert {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hpf-toggle-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.toggle-lbl {
  font-size: 11px;
  font-weight: 700;
}
.toggle-lbl.on-r {
  color: #e53935;
}
.toggle-lbl.off {
  color: #9aaac0;
}
.trim-vert {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.fader-v {
  width: 36px;
  flex: 1;
  min-height: 105px;
}

.side-num-inp {
  width: 80px;
}
.side-num-inp :deep(.q-field__control) {
  height: 28px;
  background: #ffffff;
  min-height: unset;
}
.side-num-inp :deep(input) {
  font-size: 16px;
  font-family: 'Courier New', monospace;
  text-align: center;
  color: #1e2840;
  appearance: textfield;
  -moz-appearance: textfield;
}
.side-num-inp :deep(input::-webkit-inner-spin-button) {
  display: none;
}
.side-num-inp :deep(.q-field__suffix) {
  font-size: 10px;
  color: #8a9ab4;
  padding-left: 2px;
}
.side-num-inp :deep(.q-field__native) {
  font-size: 16px;
  color: #1e2840;
  min-height: unset;
  padding: 0 2px;
}
</style>
