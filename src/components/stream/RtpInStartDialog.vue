<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent } from 'quasar'

const props = defineProps({
  detail: { type: Object, default: () => ({}) },
  name:   { type: String, default: '' },
})

defineEmits([...useDialogPluginComponent.emits])

const { t } = useI18n()
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

const sampleRateOptions = [{ label: '44.1k', value: 44100 }, { label: '48k', value: 48000 }]
const bitDepthOptions   = [{ label: '16-bit', value: 16 }, { label: '24-bit', value: 24 }]
const channelOptions    = computed(() => [{ label: t('common.mono'), value: 1 }, { label: t('common.stereo'), value: 2 }])
const protocolOptions   = [{ label: 'RTP', value: 'rtp' }, { label: 'UDP Raw', value: 'raw' }]
const formatOptions     = computed(() => [{ label: t('stream.auto'), value: 'auto' }, { label: t('stream.manual'), value: 'manual' }])
const codecOptions      = [{ label: 'MP3', value: 'mp3' }, { label: 'Opus', value: 'opus' }, { label: 'WAV', value: 'wav' }]

const protocol   = ref(props.detail?.protocol   ?? 'rtp')
const address    = ref(props.detail?.address    ?? '0.0.0.0')
const port       = ref(String(props.detail?.port    ?? ''))
const bufferMs   = ref(String(props.detail?.bufferMs ?? ''))
const channels   = ref(props.detail?.channels   ?? 2)
const formatMode = ref(props.detail?.codec ? 'manual' : 'auto')
const codec      = ref(props.detail?.codec === 'mpa' ? 'mp3'
                     : props.detail?.codec === 'l16' || props.detail?.codec === 'l24' ? 'wav'
                     : props.detail?.codec ?? 'mp3')
const sampleRate = ref(props.detail?.sampleRate ?? 48000)
const bitDepth   = ref(props.detail?.codec === 'l24' ? 24 : 16)

const showBitDepth = computed(() => formatMode.value === 'manual' && codec.value === 'wav')

// UI codec → backend codec string
function backendCodec() {
  if (codec.value === 'mp3')  return 'mpa'
  if (codec.value === 'opus') return 'opus'
  if (codec.value === 'wav')  return bitDepth.value === 16 ? 'l16' : 'l24'
  return null
}

function onOk() {
  const cfg = {
    protocol:   protocol.value,
    address:    address.value.trim() || '0.0.0.0',
    channels:   channels.value,
    formatMode: formatMode.value,
  }
  if (port.value)     cfg.port     = Number(port.value)
  if (bufferMs.value) cfg.bufferMs = Number(bufferMs.value)
  if (formatMode.value === 'manual') {
    cfg.codec      = backendCodec()
    cfg.sampleRate = sampleRate.value
  } else {
    cfg.codec      = ''
    cfg.sampleRate = null
  }
  onDialogOK(cfg)
}
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" persistent>
    <q-card style="min-width: 360px; max-width: 440px">
      <q-card-section class="row items-center q-pb-sm">
        <q-icon name="play_circle" color="positive" size="sm" class="q-mr-sm" />
        <span class="text-subtitle1 text-weight-bold">{{ t('stream.startStream') }}</span>
        <span v-if="name" class="q-ml-sm text-grey-6 text-caption">{{ name }}</span>
      </q-card-section>

      <q-separator />

      <q-card-section class="q-gutter-y-md q-pt-md">
        <!-- Protocol -->
        <div>
          <div class="field-label">{{ t('stream.protocol') }}</div>
          <q-select v-model="protocol" :options="protocolOptions" emit-value map-options dense outlined class="q-mt-xs" />
        </div>

        <!-- Address -->
        <div>
          <div class="field-label">{{ t('stream.address') }}</div>
          <q-input
            v-model="address"
            dense outlined
            placeholder="0.0.0.0 or multicast 239.x.x.x"
            class="q-mt-xs"
          />
        </div>

        <!-- Port -->
        <div>
          <div class="field-label">{{ t('stream.udpPort') }}</div>
          <q-input
            v-model="port"
            dense outlined
            type="number"
            placeholder="Port number"
            class="q-mt-xs"
          />
        </div>

        <!-- Buffer -->
        <div>
          <div class="field-label">{{ t('stream.bufferMs') }}</div>
          <q-input
            v-model="bufferMs"
            dense outlined
            type="number"
            placeholder="Buffer size in ms"
            class="q-mt-xs"
          />
        </div>

        <!-- Channels -->
        <div>
          <div class="field-label">{{ t('stream.channels') }}</div>
          <q-select v-model="channels" :options="channelOptions" emit-value map-options dense outlined class="q-mt-xs" />
        </div>

        <!-- Format -->
        <div>
          <div class="field-label">{{ t('stream.format') }}</div>
          <q-select v-model="formatMode" :options="formatOptions" emit-value map-options dense outlined class="q-mt-xs" />

          <transition name="fade">
            <div v-if="formatMode === 'manual'" class="manual-box q-mt-sm q-gutter-y-sm">
              <div>
                <div class="field-label-sub">{{ t('stream.codec') }}</div>
                <q-select v-model="codec" :options="codecOptions" emit-value map-options dense outlined class="q-mt-xs" />
              </div>
              <div>
                <div class="field-label-sub">{{ t('stream.sampleRate') }}</div>
                <q-select v-model="sampleRate" :options="sampleRateOptions" emit-value map-options dense outlined class="q-mt-xs" />
              </div>
              <transition name="fade">
                <div v-if="showBitDepth">
                  <div class="field-label-sub">{{ t('stream.bitDepth') }}</div>
                  <q-select v-model="bitDepth" :options="bitDepthOptions" emit-value map-options dense outlined class="q-mt-xs" />
                </div>
              </transition>
            </div>
          </transition>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-actions align="right" class="q-pa-sm">
        <q-btn flat :label="t('common.cancel')" color="grey-7" @click="onDialogCancel" />
        <q-btn unelevated :label="t('common.start')" color="positive" icon="play_arrow" @click="onOk" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.field-label {
  font-size: 11px;
  font-weight: 700;
  color: #90a4ae;
  letter-spacing: 0.6px;
  text-transform: uppercase;
}
.field-label-sub {
  font-size: 10px;
  font-weight: 600;
  color: #b0bec5;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}
.seg-group        { display: flex; gap: 6px; }
.seg-group--wrap  { flex-wrap: wrap; }
.seg-btn {
  background: #f5f5f5;
  border: 1px solid #cfd8dc;
  border-radius: 3px;
  padding: 6px 20px;
  font-size: 13px;
  font-weight: 600;
  color: #546e7a;
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s, color 0.1s;
}
.seg-btn--sm   { padding: 5px 12px; font-size: 12px; }
.seg-btn:hover { background: #e8f5e9; border-color: #a5d6a7; }
.seg-btn--on   { background: #2e7d32; border-color: #2e7d32; color: #fff; }

.manual-box {
  border-left: 2px solid #cfd8dc;
  padding-left: 12px;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from,   .fade-leave-to     { opacity: 0; }
</style>
