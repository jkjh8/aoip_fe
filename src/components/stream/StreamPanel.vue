<script setup>
import { ref } from 'vue'
import { api } from 'src/boot/axios'
import RtpInPanel  from './RtpInPanel.vue'
import RtpOutPanel from './RtpOutPanel.vue'

const props = defineProps({
  s:      { type: Object, required: true },
  detail: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['refresh'])

const busy = ref(false)
const rtpInRef = ref(null)

async function toggleStream() {
  busy.value = true
  try {
    if (props.s.running) {
      await api.post(`/streams/rtp/${props.s.client}/stop`)
    } else {
      const cfg = rtpInRef.value?.getPendingConfig?.() ?? {}
      await api.post(`/streams/rtp/${props.s.client}/start`, cfg)
    }
    emit('refresh', props.s.client)
  } catch (e) {
    console.error('[stream] toggle failed', e)
  } finally {
    busy.value = false
  }
}

function hasTargets() {
  return props.s.type !== 'rtp_out' || (props.detail?.targets?.length ?? 0) > 0
}

function statusDotClass() {
  if (!props.s.ready || !hasTargets()) return 'run-dot--off'
  if (props.s.type === 'rtp_in' && props.s.stats?.srcIp) return 'run-dot--streaming'
  return 'run-dot--on'
}

function statusLabelClass() {
  if (!props.s.ready || !hasTargets()) return 'run-label--off'
  if (props.s.type === 'rtp_in' && props.s.stats?.srcIp) return 'run-label--streaming'
  return 'run-label--on'
}

function statusText() {
  if (!props.s.ready || !hasTargets()) return 'NOT READY'
  if (props.s.type === 'rtp_in' && props.s.stats?.srcIp) return 'STREAMING'
  return 'READY'
}
</script>

<template>
  <div class="st-panel">
    <!-- Header -->
    <div class="st-panel-head">
      <div class="st-panel-head-left">
        <q-icon
          :name="s.type === 'rtp_in' ? 'download' : 'upload'"
          size="16px"
          :color="s.type === 'rtp_in' ? 'green-7' : 'blue-7'"
        />
        <span class="st-panel-title">{{ detail?.name ?? s.client }}</span>
        <template v-if="s.type === 'rtp_in'">
          <span v-if="detail?.address && detail.address !== '0.0.0.0'" class="port-badge">
            {{ detail.address }}:{{ detail.port }}
          </span>
          <span v-else-if="detail?.port" class="port-badge">:{{ detail.port }}</span>
          <span v-if="detail?.protocol" class="proto-badge">{{ detail.protocol.toUpperCase() }}</span>
        </template>
        <span class="run-dot" :class="statusDotClass()" />
        <span class="run-label" :class="statusLabelClass()">{{ statusText() }}</span>
      </div>
      <div class="head-right">
        <q-btn
          flat round size="md"
          :icon="s.running ? 'stop_circle' : 'play_circle'"
          :color="s.running ? 'negative' : 'positive'"
          :loading="busy"
          @click="toggleStream"
        >
          <q-tooltip class="bg-grey-4 text-grey-9" anchor="top middle" self="bottom middle" :offset="[0, 4]">
            {{ s.running ? 'Stop' : 'Start' }}
          </q-tooltip>
        </q-btn>
        <span class="type-badge" :class="s.type === 'rtp_in' ? 'type-badge--in' : 'type-badge--out'">
          {{ s.type === 'rtp_in' ? 'IN' : 'OUT' }}
        </span>
      </div>
    </div>
    <q-separator />

    <RtpInPanel  v-if="s.type === 'rtp_in'"  ref="rtpInRef" :s="s" :detail="detail" @refresh="emit('refresh', s.client)" />
    <RtpOutPanel v-else                       :s="s" :detail="detail" @refresh="emit('refresh', s.client)" />
  </div>
</template>

<style scoped>
.st-panel {
  background: #fff;
  border: 1px solid #e4e6ea;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
}

.st-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
}
.st-panel-head-left {
  display: flex;
  align-items: center;
  gap: 9px;
}
.st-panel-title {
  font-size: 16px;
  font-weight: 600;
  color: #37474f;
}

.head-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.type-badge {
  font-size: 10px;
  font-weight: 800;
  padding: 3px 9px;
  border-radius: 3px;
  letter-spacing: 0.5px;
}
.type-badge--in  { background: #e8f5e9; color: #2e7d32; }
.type-badge--out { background: #e3f2fd; color: #1565c0; }

.run-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.run-dot--on        { background: #43a047; box-shadow: 0 0 0 2px #c8e6c9; }
.run-dot--off       { background: #bdbdbd; }
.run-dot--streaming { background: #00acc1; box-shadow: 0 0 0 2px #b2ebf2; }

.proto-badge {
  font-size: 10px;
  font-weight: 800;
  color: #2e7d32;
  background: #e8f5e9;
  border: 1px solid #a5d6a7;
  border-radius: 3px;
  padding: 1px 6px;
  letter-spacing: 0.4px;
}

.port-badge {
  font-size: 12px;
  font-weight: 700;
  color: #1565c0;
  font-family: 'Courier New', monospace;
  background: #e3f2fd;
  border: 1px solid #90caf9;
  border-radius: 3px;
  padding: 1px 6px;
}

.run-label { font-size: 11px; font-weight: 800; letter-spacing: 0.5px; }
.run-label--on        { color: #2e7d32; }
.run-label--off       { color: #9e9e9e; }
.run-label--streaming { color: #00838f; }
</style>
