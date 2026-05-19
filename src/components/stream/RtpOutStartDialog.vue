<script setup>
import { ref, computed } from 'vue'
import { useDialogPluginComponent } from 'quasar'

const props = defineProps({
  detail: { type: Object, default: () => ({}) },
  name:   { type: String, default: '' },
})

defineEmits([...useDialogPluginComponent.emits])

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

const bitrateOptions = {
  mp3:  [128, 160, 192, 224, 256, 320],
  opus: [64,  96,  128, 192, 256, 320],
}
const sampleRateOptions = [{ label: '44.1k', value: 44100 }, { label: '48k', value: 48000 }]
const channelOptions    = [{ label: 'Mono', value: 1 }, { label: 'Stereo', value: 2 }]
const protocolOptions   = [{ label: 'RTP', value: 'rtp' }, { label: 'UDP Raw', value: 'udp' }]
const codecOptions      = [{ label: 'MP3', value: 'mp3' }, { label: 'Opus', value: 'opus' }, { label: 'RAW PCM', value: 'raw' }]

const bitrateSelectOptions = computed(() =>
  (bitrateOptions[codec.value] ?? []).map((v) => ({ label: `${v}k`, value: v })),
)

const channels   = ref(props.detail?.channels   ?? 2)
const protocol   = ref(props.detail?.protocol   ?? 'rtp')
const codec      = ref(props.detail?.codec      ?? 'mp3')
const bitrate    = ref(props.detail?.bitrate    ?? 320)
const sampleRate = ref(props.detail?.sampleRate ?? 48000)

const firstTarget = props.detail?.targets?.[0] ?? props.detail?.target ?? null
const host = ref(firstTarget?.host ?? '')
const port = ref(firstTarget?.port ? String(firstTarget.port) : '')

const showBitrate = computed(() => codec.value !== 'raw')

function onCodecChange(c) {
  codec.value = c
  if (c !== 'raw') {
    const opts = bitrateOptions[c] ?? []
    if (!opts.includes(bitrate.value)) bitrate.value = opts.at(-1)
  }
}

function onOk() {
  const cfg = {
    channels:   channels.value,
    protocol:   protocol.value,
    codec:      codec.value,
    sampleRate: sampleRate.value,
    host: host.value.trim(),
    port: port.value ? Number(port.value) : null,
  }
  if (codec.value !== 'raw') cfg.bitrate = bitrate.value
  onDialogOK(cfg)
}
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" persistent>
    <q-card style="min-width: 340px; max-width: 420px">
      <q-card-section class="row items-center q-pb-sm">
        <q-icon name="play_circle" color="positive" size="sm" class="q-mr-sm" />
        <span class="text-subtitle1 text-weight-bold">Start Stream</span>
        <span v-if="name" class="q-ml-sm text-grey-6 text-caption">{{ name }}</span>
      </q-card-section>

      <q-separator />

      <q-card-section class="q-gutter-y-md q-pt-md">
        <!-- Channels -->
        <div>
          <div class="field-label">Channels</div>
          <q-select v-model="channels" :options="channelOptions" emit-value map-options dense outlined class="q-mt-xs" />
        </div>

        <!-- Protocol -->
        <div>
          <div class="field-label">Protocol</div>
          <q-select v-model="protocol" :options="protocolOptions" emit-value map-options dense outlined class="q-mt-xs" />
        </div>

        <!-- Codec -->
        <div>
          <div class="field-label">Codec</div>
          <q-select
            :model-value="codec"
            :options="codecOptions"
            emit-value map-options dense outlined class="q-mt-xs"
            @update:model-value="onCodecChange"
          />
        </div>

        <!-- Bitrate -->
        <transition name="fade">
          <div v-if="showBitrate">
            <div class="field-label">Bitrate</div>
            <q-select v-model="bitrate" :options="bitrateSelectOptions" emit-value map-options dense outlined class="q-mt-xs" />
          </div>
        </transition>

        <!-- Sample Rate -->
        <div>
          <div class="field-label">Sample Rate</div>
          <q-select v-model="sampleRate" :options="sampleRateOptions" emit-value map-options dense outlined class="q-mt-xs" />
        </div>

        <!-- Destination -->
        <div>
          <div class="field-label">Destination</div>
          <div class="dest-row q-mt-xs">
            <input v-model="host" class="add-input add-input--host" placeholder="Host / IP" />
            <span class="add-sep">:</span>
            <input v-model="port" class="add-input add-input--port" placeholder="Port" type="number" />
          </div>
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
  font-size: 11px; font-weight: 700; color: #90a4ae;
  letter-spacing: 0.6px; text-transform: uppercase;
}
.seg-group         { display: flex; gap: 6px; }
.seg-group--wrap   { flex-wrap: wrap; }
.seg-btn {
  background: #f5f5f5; border: 1px solid #cfd8dc; border-radius: 3px;
  padding: 6px 16px; font-size: 13px; font-weight: 600; color: #546e7a;
  cursor: pointer; transition: background 0.1s, border-color 0.1s, color 0.1s;
}
.seg-btn--sm  { padding: 5px 10px; font-size: 12px; }
.seg-btn:hover { background: #e3f2fd; border-color: #90caf9; }
.seg-btn--on   { background: #1565c0; border-color: #1565c0; color: #fff; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from,   .fade-leave-to     { opacity: 0; }

.dest-row { display: flex; align-items: center; gap: 4px; }
.add-input {
  border: 1px solid #cfd8dc; border-radius: 3px;
  padding: 5px 8px; font-size: 13px; color: #37474f;
  outline: none; background: #fafafa;
}
.add-input:focus { border-color: #1976d2; background: #fff; }
.add-input--host { flex: 1; min-width: 0; }
.add-input--port { width: 72px; }
.add-sep { color: #90a4ae; font-size: 13px; flex-shrink: 0; }
</style>
