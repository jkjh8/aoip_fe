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

const sampleRateOptions = [44100, 48000]

const protocol   = ref(props.detail?.protocol   ?? 'rtp')
const codec      = ref(props.detail?.codec      ?? 'mp3')
const bitrate    = ref(props.detail?.bitrate    ?? 320)
const sampleRate = ref(props.detail?.sampleRate ?? 48000)

const showBitrate = computed(() => codec.value !== 'raw')

function onCodecChange(c) {
  codec.value = c
  if (c !== 'raw') {
    const opts = bitrateOptions[c] ?? []
    if (!opts.includes(bitrate.value)) bitrate.value = opts.at(-1)
  }
}

// Targets
const MAX_TARGETS = 8
const targets = ref(
  props.detail?.targets?.length
    ? props.detail.targets.map(t => ({ host: t.host, port: String(t.port) }))
    : [{ host: '', port: '' }]
)

function addTarget() {
  if (targets.value.length >= MAX_TARGETS) return
  targets.value.push({ host: '', port: '' })
}

function removeTarget(i) {
  targets.value.splice(i, 1)
}

function onOk() {
  const cfg = {
    protocol: protocol.value,
    codec:    codec.value,
    targets:  targets.value
      .filter(t => t.host.trim() && t.port)
      .map(t => ({ host: t.host.trim(), port: Number(t.port) })),
  }
  if (codec.value !== 'raw') cfg.bitrate = bitrate.value
  cfg.sampleRate = sampleRate.value
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
            <button class="seg-btn" :class="{ 'seg-btn--on': protocol === 'udp' }" @click="protocol = 'udp'">UDP Raw</button>
          </div>
        </div>

        <!-- Codec -->
        <div>
          <div class="field-label">Codec</div>
          <div class="seg-group q-mt-xs">
            <button class="seg-btn" :class="{ 'seg-btn--on': codec === 'mp3' }"  @click="onCodecChange('mp3')">MP3</button>
            <button class="seg-btn" :class="{ 'seg-btn--on': codec === 'opus' }" @click="onCodecChange('opus')">Opus</button>
            <button class="seg-btn" :class="{ 'seg-btn--on': codec === 'raw' }"  @click="onCodecChange('raw')">RAW PCM</button>
          </div>
        </div>

        <!-- Bitrate -->
        <transition name="fade">
          <div v-if="showBitrate">
            <div class="field-label">Bitrate</div>
            <div class="seg-group seg-group--wrap q-mt-xs">
              <button
                v-for="br in (bitrateOptions[codec] ?? [])"
                :key="br"
                class="seg-btn seg-btn--sm"
                :class="{ 'seg-btn--on': bitrate === br }"
                @click="bitrate = br"
              >{{ br }}k</button>
            </div>
          </div>
        </transition>

        <!-- Sample Rate -->
        <div>
          <div class="field-label">Sample Rate</div>
          <div class="seg-group q-mt-xs">
            <button
              v-for="sr in sampleRateOptions"
              :key="sr"
              class="seg-btn seg-btn--sm"
              :class="{ 'seg-btn--on': sampleRate === sr }"
              @click="sampleRate = sr"
            >{{ sr >= 1000 ? (sr / 1000) + 'k' : sr }}</button>
          </div>
        </div>

        <!-- Targets -->
        <div>
          <div class="dest-header">
            <div class="field-label">Destinations</div>
            <button
              class="add-btn"
              :disabled="targets.length >= MAX_TARGETS"
              @click="addTarget"
            >
              <q-icon name="add" size="16px" />
            </button>
          </div>
          <div class="target-list q-mt-xs">
            <div v-if="!targets.length" class="target-empty">No destinations — press + to add</div>
            <div v-for="(t, i) in targets" :key="i" class="target-row">
              <input
                v-model="t.host"
                class="add-input add-input--host"
                placeholder="Host / IP"
              />
              <span class="add-sep">:</span>
              <input
                v-model="t.port"
                class="add-input add-input--port"
                placeholder="Port"
                type="number"
              />
              <button class="target-del" @click="removeTarget(i)">
                <q-icon name="close" size="14px" />
              </button>
            </div>
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
  font-size: 11px;
  font-weight: 700;
  color: #90a4ae;
  letter-spacing: 0.6px;
  text-transform: uppercase;
}
.seg-group         { display: flex; gap: 6px; }
.seg-group--wrap   { flex-wrap: wrap; }
.seg-btn {
  background: #f5f5f5;
  border: 1px solid #cfd8dc;
  border-radius: 3px;
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #546e7a;
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s, color 0.1s;
}
.seg-btn--sm  { padding: 5px 10px; font-size: 12px; }
.seg-btn:hover { background: #e3f2fd; border-color: #90caf9; }
.seg-btn--on   { background: #1565c0; border-color: #1565c0; color: #fff; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from,   .fade-leave-to     { opacity: 0; }

/* ── Targets ── */
.dest-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.target-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.target-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.target-del  {
  background: none; border: none; cursor: pointer;
  color: #b0bec5; display: flex; align-items: center; padding: 2px;
  flex-shrink: 0;
}
.target-del:hover { color: #e53935; }
.target-empty {
  font-size: 12px;
  color: #b0bec5;
  padding: 4px 2px;
}
.add-input {
  border: 1px solid #cfd8dc;
  border-radius: 3px;
  padding: 5px 8px;
  font-size: 13px;
  color: #37474f;
  outline: none;
  background: #fafafa;
}
.add-input:focus { border-color: #1976d2; background: #fff; }
.add-input--host { flex: 1; min-width: 0; }
.add-input--port { width: 72px; }
.add-sep { color: #90a4ae; font-size: 13px; flex-shrink: 0; }
.add-btn {
  background: #1565c0; border: none; border-radius: 3px;
  color: #fff; cursor: pointer; padding: 4px 8px;
  display: flex; align-items: center;
}
.add-btn:hover { background: #1976d2; }
.add-btn:disabled { background: #b0bec5; cursor: not-allowed; }
</style>
