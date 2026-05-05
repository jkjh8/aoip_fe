<script setup>
import { ref } from 'vue'
import { useDialogPluginComponent } from 'quasar'

const props = defineProps({
  detail: { type: Object, default: () => ({}) },
  name:   { type: String, default: '' },
})

defineEmits([...useDialogPluginComponent.emits])

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

const protocol  = ref(props.detail?.protocol  ?? 'rtp')
const address   = ref(props.detail?.address   ?? '0.0.0.0')
const port      = ref(String(props.detail?.port      ?? ''))
const bufferMs  = ref(String(props.detail?.bufferMs  ?? ''))
const channels  = ref(props.detail?.channels  ?? 2)

function onOk() {
  const cfg = {
    protocol: protocol.value,
    address:  address.value.trim() || '0.0.0.0',
    channels: channels.value,
  }
  if (port.value)     cfg.port     = Number(port.value)
  if (bufferMs.value) cfg.bufferMs = Number(bufferMs.value)
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
            placeholder="0.0.0.0 또는 멀티캐스트 239.x.x.x"
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
            placeholder="포트 번호"
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
            placeholder="버퍼 (ms)"
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
.seg-group { display: flex; gap: 6px; }
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
.seg-btn:hover  { background: #e8f5e9; border-color: #a5d6a7; }
.seg-btn--on    { background: #2e7d32; border-color: #2e7d32; color: #fff; }
</style>
