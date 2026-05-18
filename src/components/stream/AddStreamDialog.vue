<script setup>
import { ref, computed } from 'vue'
import { useDialogPluginComponent } from 'quasar'

const props = defineProps({
  type: { type: String, required: true }, // 'rtp_in' | 'rtp_out'
})

defineEmits([...useDialogPluginComponent.emits])
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

const name     = ref('')
const channels = ref(2)

// ── rtp_in ───────────────────────────────────────────────
const inProtocol   = ref('rtp')
const inAddress    = ref('0.0.0.0')
const inPort       = ref('')
const inBufferMs   = ref('')
const inFormatMode = ref('auto')
const inCodec      = ref('mp3')
const inSampleRate = ref(48000)
const inBitDepth   = ref(16)

const sampleRateOptions = [44100, 48000]
const bitDepthOptions   = [16, 24]

const showBitDepth = computed(
  () => inFormatMode.value === 'manual' && inCodec.value === 'wav',
)

function backendCodecIn() {
  if (inCodec.value === 'mp3')  return 'mpa'
  if (inCodec.value === 'opus') return 'opus'
  if (inCodec.value === 'wav')  return inBitDepth.value === 16 ? 'l16' : 'l24'
  return null
}

// ── rtp_out ──────────────────────────────────────────────
const outProtocol   = ref('rtp')
const outCodec      = ref('mp3')
const outBitrate    = ref(320)
const outSampleRate = ref(48000)
const outHost       = ref('')
const outPort       = ref('')

const bitrateOptions = {
  mp3:  [128, 160, 192, 224, 256, 320],
  opus: [64,  96,  128, 192, 256, 320],
}
const showBitrate = computed(() => outCodec.value !== 'raw')

function onOutCodecChange(c) {
  outCodec.value = c
  if (c !== 'raw') {
    const opts = bitrateOptions[c] ?? []
    if (!opts.includes(outBitrate.value)) outBitrate.value = opts.at(-1)
  }
}

// ── submit ───────────────────────────────────────────────
const isValid = computed(() => name.value.trim().length > 0)

function onOk() {
  if (!isValid.value) return

  if (props.type === 'rtp_in') {
    const cfg = {
      name:       name.value.trim(),
      channels:   channels.value,
      protocol:   inProtocol.value,
      address:    inAddress.value.trim() || '0.0.0.0',
      formatMode: inFormatMode.value,
    }
    if (inPort.value)     cfg.port     = Number(inPort.value)
    if (inBufferMs.value) cfg.bufferMs = Number(inBufferMs.value)
    if (inFormatMode.value === 'manual') {
      cfg.codec      = backendCodecIn()
      cfg.sampleRate = inSampleRate.value
    } else {
      cfg.codec      = ''
      cfg.sampleRate = null
    }
    onDialogOK(cfg)
  } else {
    const cfg = {
      name:       name.value.trim(),
      channels:   channels.value,
      protocol:   outProtocol.value,
      codec:      outCodec.value,
      sampleRate: outSampleRate.value,
      host:       outHost.value.trim(),
      port:       outPort.value ? Number(outPort.value) : null,
    }
    if (outCodec.value !== 'raw') cfg.bitrate = outBitrate.value
    onDialogOK(cfg)
  }
}
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" persistent>
    <q-card style="min-width: 360px; max-width: 440px">
      <q-card-section class="row items-center q-pb-sm">
        <q-icon
          name="add_circle"
          :color="type === 'rtp_in' ? 'green-7' : 'blue-7'"
          size="sm"
          class="q-mr-sm"
        />
        <span class="text-subtitle1 text-weight-bold">
          New {{ type === 'rtp_in' ? 'Input' : 'Output' }} Stream
        </span>
      </q-card-section>

      <q-separator />

      <q-card-section class="q-gutter-y-md q-pt-md">
        <!-- Name -->
        <div>
          <div class="field-label">Name</div>
          <input
            v-model="name"
            class="add-input add-input--full"
            placeholder="Stream name"
            autofocus
          />
        </div>

        <!-- Channels -->
        <div>
          <div class="field-label">Channels</div>
          <div class="seg-group">
            <button class="seg-btn" :class="{ 'seg-btn--on': channels === 1 }" @click="channels = 1">Mono</button>
            <button class="seg-btn" :class="{ 'seg-btn--on': channels === 2 }" @click="channels = 2">Stereo</button>
          </div>
        </div>

        <!-- ─── rtp_in 전용 ─── -->
        <template v-if="type === 'rtp_in'">
          <div>
            <div class="field-label">Protocol</div>
            <div class="seg-group">
              <button class="seg-btn" :class="{ 'seg-btn--on': inProtocol === 'rtp' }" @click="inProtocol = 'rtp'">RTP</button>
              <button class="seg-btn" :class="{ 'seg-btn--on': inProtocol === 'raw' }" @click="inProtocol = 'raw'">UDP Raw</button>
            </div>
          </div>

          <div>
            <div class="field-label">Address</div>
            <input v-model="inAddress" class="add-input add-input--full" placeholder="0.0.0.0 or multicast 239.x.x.x" />
          </div>

          <div>
            <div class="field-label">UDP Receive Port</div>
            <input v-model="inPort" class="add-input add-input--full" type="number" placeholder="Port number" />
          </div>

          <div>
            <div class="field-label">Buffer (ms)</div>
            <input v-model="inBufferMs" class="add-input add-input--full" type="number" placeholder="Buffer size in ms" />
          </div>

          <div>
            <div class="field-label">Format</div>
            <div class="seg-group">
              <button class="seg-btn" :class="{ 'seg-btn--on': inFormatMode === 'auto' }"   @click="inFormatMode = 'auto'">Auto Detect</button>
              <button class="seg-btn" :class="{ 'seg-btn--on': inFormatMode === 'manual' }" @click="inFormatMode = 'manual'">Manual</button>
            </div>
            <transition name="fade">
              <div v-if="inFormatMode === 'manual'" class="manual-box q-mt-sm q-gutter-y-sm">
                <div>
                  <div class="field-label-sub">Codec</div>
                  <div class="seg-group">
                    <button class="seg-btn seg-btn--sm" :class="{ 'seg-btn--on': inCodec === 'mp3' }"  @click="inCodec = 'mp3'">MP3</button>
                    <button class="seg-btn seg-btn--sm" :class="{ 'seg-btn--on': inCodec === 'opus' }" @click="inCodec = 'opus'">Opus</button>
                    <button class="seg-btn seg-btn--sm" :class="{ 'seg-btn--on': inCodec === 'wav' }"  @click="inCodec = 'wav'">WAV</button>
                  </div>
                </div>
                <div>
                  <div class="field-label-sub">Sample Rate</div>
                  <div class="seg-group">
                    <button
                      v-for="sr in sampleRateOptions"
                      :key="sr"
                      class="seg-btn seg-btn--sm"
                      :class="{ 'seg-btn--on': inSampleRate === sr }"
                      @click="inSampleRate = sr"
                    >{{ sr / 1000 }}k</button>
                  </div>
                </div>
                <transition name="fade">
                  <div v-if="showBitDepth">
                    <div class="field-label-sub">Bit Depth</div>
                    <div class="seg-group">
                      <button
                        v-for="bd in bitDepthOptions"
                        :key="bd"
                        class="seg-btn seg-btn--sm"
                        :class="{ 'seg-btn--on': inBitDepth === bd }"
                        @click="inBitDepth = bd"
                      >{{ bd }}-bit</button>
                    </div>
                  </div>
                </transition>
              </div>
            </transition>
          </div>
        </template>

        <!-- ─── rtp_out 전용 ─── -->
        <template v-else>
          <div>
            <div class="field-label">Protocol</div>
            <div class="seg-group">
              <button class="seg-btn" :class="{ 'seg-btn--on': outProtocol === 'rtp' }" @click="outProtocol = 'rtp'">RTP</button>
              <button class="seg-btn" :class="{ 'seg-btn--on': outProtocol === 'udp' }" @click="outProtocol = 'udp'">UDP Raw</button>
            </div>
          </div>

          <div>
            <div class="field-label">Codec</div>
            <div class="seg-group">
              <button class="seg-btn" :class="{ 'seg-btn--on': outCodec === 'mp3' }"  @click="onOutCodecChange('mp3')">MP3</button>
              <button class="seg-btn" :class="{ 'seg-btn--on': outCodec === 'opus' }" @click="onOutCodecChange('opus')">Opus</button>
              <button class="seg-btn" :class="{ 'seg-btn--on': outCodec === 'raw' }"  @click="onOutCodecChange('raw')">RAW PCM</button>
            </div>
          </div>

          <transition name="fade">
            <div v-if="showBitrate">
              <div class="field-label">Bitrate</div>
              <div class="seg-group seg-group--wrap">
                <button
                  v-for="br in (bitrateOptions[outCodec] ?? [])"
                  :key="br"
                  class="seg-btn seg-btn--sm"
                  :class="{ 'seg-btn--on': outBitrate === br }"
                  @click="outBitrate = br"
                >{{ br }}k</button>
              </div>
            </div>
          </transition>

          <div>
            <div class="field-label">Sample Rate</div>
            <div class="seg-group">
              <button
                v-for="sr in sampleRateOptions"
                :key="sr"
                class="seg-btn seg-btn--sm"
                :class="{ 'seg-btn--on': outSampleRate === sr }"
                @click="outSampleRate = sr"
              >{{ sr >= 1000 ? (sr / 1000) + 'k' : sr }}</button>
            </div>
          </div>

          <div>
            <div class="field-label">Destination</div>
            <div class="dest-row">
              <input v-model="outHost" class="add-input add-input--host" placeholder="Host / IP" />
              <span class="add-sep">:</span>
              <input v-model="outPort" class="add-input add-input--port" placeholder="Port" type="number" />
            </div>
          </div>
        </template>
      </q-card-section>

      <q-separator />

      <q-card-actions align="right" class="q-pa-sm">
        <q-btn flat label="Cancel" color="grey-7" @click="onDialogCancel" />
        <q-btn
          unelevated
          label="Create & Start"
          :color="type === 'rtp_in' ? 'green-8' : 'blue-8'"
          icon="add"
          :disable="!isValid"
          @click="onOk"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.field-label {
  font-size: 11px; font-weight: 700; color: #90a4ae;
  letter-spacing: 0.6px; text-transform: uppercase;
  margin-bottom: 4px;
}
.field-label-sub {
  font-size: 10px; font-weight: 600; color: #b0bec5;
  letter-spacing: 0.4px; text-transform: uppercase;
}
.seg-group         { display: flex; gap: 6px; }
.seg-group--wrap   { flex-wrap: wrap; }
.seg-btn {
  background: #f5f5f5; border: 1px solid #cfd8dc; border-radius: 3px;
  padding: 6px 18px; font-size: 13px; font-weight: 600; color: #546e7a;
  cursor: pointer; transition: background 0.1s, border-color 0.1s, color 0.1s;
}
.seg-btn--sm  { padding: 5px 10px; font-size: 12px; }
.seg-btn:hover { background: #e3f2fd; border-color: #90caf9; }
.seg-btn--on   { background: #1565c0; border-color: #1565c0; color: #fff; }

.add-input {
  border: 1px solid #cfd8dc; border-radius: 3px;
  padding: 6px 10px; font-size: 13px; color: #37474f;
  outline: none; background: #fafafa; width: 100%; box-sizing: border-box;
}
.add-input:focus { border-color: #1976d2; background: #fff; }
.add-input--full  { display: block; }
.add-input--host  { flex: 1; min-width: 0; width: auto; }
.add-input--port  { width: 80px; }

.dest-row { display: flex; align-items: center; gap: 4px; }
.add-sep  { color: #90a4ae; font-size: 13px; flex-shrink: 0; }

.manual-box {
  border-left: 2px solid #cfd8dc;
  padding-left: 12px;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from,   .fade-leave-to     { opacity: 0; }
</style>
