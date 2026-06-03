<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { socket } from 'src/boot/socket'
import 'src/css/dsp-dialog.css'
import EqPanel from './dsp/EqPanel.vue'
import GateTab from './dsp/GateTab.vue'
import CompTab from './dsp/CompTab.vue'
import LimiterTab from './dsp/LimiterTab.vue'
import LevelVolPanel from './LevelVolPanel.vue'

const props = defineProps({
  modelValue: Boolean,
  channel: Object,
  channelRight: Object,
  // When true, the backend mirrors DSP changes between channel and channelRight,
  // so the dialog should only emit to one channel (the meter still shows both).
  mirrored: Boolean,
})
const { t } = useI18n()
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
const limRef = ref(null)
const levelRef = ref(null)

// ── Proc-sum ─────────────────────────────────────────────────
const eqBypass = computed(() => props.channel?.dsp?.eqBypass ?? false)
const eqEnabledCount = computed(() => props.channel?.dsp?.eq?.filter((b) => b.enabled)?.length ?? 0)
const gateEnabled = computed(() => gateRef.value?.enabled ?? false)
const compEnabled = computed(() => compRef.value?.enabled ?? false)
const limEnabled = computed(() => limRef.value?.enabled ?? false)

// ── Tab ──────────────────────────────────────────────────────
const activeTab = ref('eq')

// ── GR ───────────────────────────────────────────────────────
const gateGrDb = ref(0)
const compGrDb = ref(0)
const limGrDb = ref(0)

function onGr(data) {
  if (!props.modelValue || !props.channel) return
  const out = data.outputs?.find((o) => o.ch === props.channel.id)
  gateGrDb.value = out ? -(out.gate ?? 0) : 0
  compGrDb.value = out ? -(out.comp ?? 0) : 0
  limGrDb.value = out ? -(out.lim ?? 0) : 0
}
socket.on('gr', onGr)
onUnmounted(() => {
  socket.off('gr', onGr)
  socket.emit('dsp:gr:disable')
})

function initFromChannel() {
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
      gateGrDb.value = 0
      compGrDb.value = 0
      limGrDb.value = 0
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
        <span class="dsp-hd-title">{{ t('mixer.outputDsp') }}</span>
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
        <q-btn
          no-caps
          unelevated
          padding="5px 10px"
          class="pchip"
          :class="{ 'pchip--cur': activeTab === 'lim' }"
          @click="activeTab = 'lim'"
        >
          <div class="pled" :class="limEnabled ? 'pled--warn' : 'pled--off'" />
          <span class="pname">LIMITER</span>
        </q-btn>
      </div>

      <!-- Body -->
      <div class="dsp-body">
        <!-- CENTER: Tab content -->
        <div class="center-col">
          <EqPanel
            ref="eqRef"
            v-show="activeTab === 'eq'"
            :channel="channel"
            :channel-right="chR"
            channel-type="output"
            :has-hpf="false"
            clip-id="odsp-clip"
          />
          <GateTab
            ref="gateRef"
            v-show="activeTab === 'gate'"
            :channel="channel"
            :channel-right="chR"
            channel-type="output"
            :gr-db="gateGrDb"
          />
          <CompTab
            ref="compRef"
            v-show="activeTab === 'comp'"
            :channel="channel"
            :channel-right="chR"
            channel-type="output"
            :gr-db="compGrDb"
          />
          <LimiterTab
            ref="limRef"
            v-show="activeTab === 'lim'"
            :channel="channel"
            :channel-right="chR"
            :gr-db="limGrDb"
          />
        </div>

        <!-- RIGHT: Level + Vol -->
        <LevelVolPanel
          ref="levelRef"
          :channel="channel"
          :channel-right="channelRight"
          channel-type="output"
        />
      </div>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.dsp-card {
  background: #f4f6fb;
  border-radius: 10px;
  width: 1050px;
  height: 820px;
  max-width: 98vw;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(30, 50, 100, 0.18);
}
.pled--warn {
  background: #ef5350;
  box-shadow: 0 0 5px #ef535099;
}
</style>
