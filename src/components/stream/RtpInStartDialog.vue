<script setup>
import { ref, computed } from 'vue'
import { useDialogPluginComponent } from 'quasar'

const props = defineProps({
  detail: { type: Object, default: () => ({}) },
  name:   { type: String, default: '' },
})

defineEmits([...useDialogPluginComponent.emits])

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

const sampleRateOptions = [44100, 48000]
const bitDepthOptions   = [16, 24]

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
        <span class="text-subtitle1 text-weight-bold">Start Stream</span>
        <span v-if="name" class="q-ml-sm text-grey-6 text-caption">{{ name }}</span>
      </q-card-section>

      <q-separator />

      <q-card-section class="q-gutter-y-md q-pt-md">
        <!-- Protocol -->
        <div>
          <div class="field-label">Protocol</div>
          <div class="seg-group q-mt-xs">
            <button class="seg-btn" :class="{ 'seg-btn--on': protocol === 'rtp' }" @click="protocol = 'rtp'">RTP</button>
            <button class="seg-btn" :class="{ 'seg-btn--on': protocol === 'raw' }" @click="protocol = 'raw'">UDP Raw</button>
          </div>
        </div>

        <!-- Address -->
        <div>
          <div class="field-label">Address</div>
          <q-input
            v-model="address"
            dense outlined
            placeholder="0.0.0.0 or multicast 239.x.x.x"
            class="q-mt-xs"
          />
        </div>

        <!-- Port -->
        <div>
          <div class="field-label">UDP Receive Port</div>
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
          <div class="field-label">Buffer (ms)</div>
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
          <div class="field-label">Channels</div>
          <div class="seg-group q-mt-xs">
            <button class="seg-btn" :class="{ 'seg-btn--on': channels === 1 }" @click="channels = 1">Mono</button>
            <button class="seg-btn" :class="{ 'seg-btn--on': channels === 2 }" @click="channels = 2">Stereo</button>
          </div>
        </div>

        <!-- Format -->
        <div>
          <div class="field-label">Format</div>
          <div class="seg-group q-mt-xs">
            <button class="seg-btn" :class="{ 'seg-btn--on': formatMode === 'auto' }"   @click="formatMode = 'auto'">Auto Detect</button>
            <button class="seg-btn" :class="{ 'seg-btn--on': formatMode === 'manual' }" @click="formatMode = 'manual'">Manual</button>
          </div>

          <transition name="fade">
            <div v-if="formatMode === 'manual'" class="manual-box q-mt-sm q-gutter-y-sm">
              <!-- Codec -->
              <div>
                <div class="field-label-sub">Codec</div>
                <div class="seg-group q-mt-xs">
                  <button class="seg-btn seg-btn--sm" :class="{ 'seg-btn--on': codec === 'mp3' }"  @click="codec = 'mp3'">MP3</button>
                  <button class="seg-btn seg-btn--sm" :class="{ 'seg-btn--on': codec === 'opus' }" @click="codec = 'opus'">Opus</button>
                  <button class="seg-btn seg-btn--sm" :class="{ 'seg-btn--on': codec === 'wav' }"  @click="codec = 'wav'">WAV</button>
                </div>
              </div>

              <!-- Sample Rate -->
              <div>
                <div class="field-label-sub">Sample Rate</div>
                <div class="seg-group q-mt-xs">
                  <button
                    v-for="sr in sampleRateOptions"
                    :key="sr"
                    class="seg-btn seg-btn--sm"
                    :class="{ 'seg-btn--on': sampleRate === sr }"
                    @click="sampleRate = sr"
                  >{{ sr / 1000 }}k</button>
                </div>
              </div>

              <!-- Bit Depth (WAV only) -->
              <transition name="fade">
                <div v-if="showBitDepth">
                  <div class="field-label-sub">Bit Depth</div>
                  <div class="seg-group q-mt-xs">
                    <button
                      v-for="bd in bitDepthOptions"
                      :key="bd"
                      class="seg-btn seg-btn--sm"
                      :class="{ 'seg-btn--on': bitDepth === bd }"
                      @click="bitDepth = bd"
                    >{{ bd }}-bit</button>
                  </div>
                </div>
              </transition>
            </div>
          </transition>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-actions align="right" class="q-pa-sm">
        <q-btn flat label="Cancel" color="grey-7" @click="onDialogCancel" />
        <q-btn unelevated label="Start" color="positive" icon="play_arrow" @click="onOk" />
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
