<script setup>
import { computed, ref } from 'vue'
import { socket } from 'src/boot/socket'
import { useQuasar } from 'quasar'
import { useAoipStore } from 'src/stores/aoip'
import RtpInPanel from './RtpInPanel.vue'
import RtpOutPanel from './RtpOutPanel.vue'
import LevelMeter from 'src/components/mixer/LevelMeter.vue'
import RtpInStartDialog from './RtpInStartDialog.vue'
import RtpOutStartDialog from './RtpOutStartDialog.vue'

const props = defineProps({
  s: { type: Object, required: true },
  detail: { type: Object, default: () => ({}) },
  meterChannels: { type: Array, default: null },
})

const aoipState = useAoipStore()
const $q = useQuasar()

const apiBase = process.env.DEV
  ? 'http://192.168.10.103:3000'
  : `${window.location.protocol}//${window.location.hostname}:3000`

const displayMeterChannels = computed(() => {
  const allChs = (
    props.s.type === 'rtp_in' ? aoipState.channels.inputs : aoipState.channels.outputs
  ).filter((ch) => ch.label.toLowerCase().includes('stream'))

  if (props.meterChannels?.length) return props.meterChannels
  if (!allChs.length) return []

  const sameType = (aoipState.streams?.rtpStreams ?? []).filter((s) => s.type === props.s.type)
  const myIdx = sameType.findIndex((s) => s.client === props.s.client)
  if (myIdx < 0) return []

  const n = props.detail?.channels ?? 2
  return allChs.slice(myIdx * n, myIdx * n + n)
})

const emit = defineEmits(['refresh', 'remove'])
const busy = ref(false)

// ── stop (socket) ─────────────────────────────────────────
function toggleStream() {
  if (props.s.running) {
    $q.dialog({
      title: '스트림 정지',
      message: `"${props.detail?.name ?? props.s.client}" 스트림을 정지하시겠습니까?`,
      cancel: { flat: true, label: '취소' },
      ok: { unelevated: true, label: '정지', color: 'negative' },
      persistent: true,
    }).onOk(() => {
      busy.value = true
      socket.emit('rtp:stream:stop', { client: props.s.client }, (res) => {
        busy.value = false
        if (!res?.ok) console.error('[stream] stop failed', res?.error)
        else emit('refresh', props.s.client)
      })
    })
  } else {
    openEdit()
  }
}

// ── edit dialogs ──────────────────────────────────────────
function openEdit() {
  if (props.s.type === 'rtp_in') {
    $q.dialog({
      component: RtpInStartDialog,
      componentProps: { detail: props.detail, name: props.detail?.name ?? props.s.client },
    }).onOk((cfg) => applyRtpIn(cfg))
  } else {
    $q.dialog({
      component: RtpOutStartDialog,
      componentProps: { detail: props.detail, name: props.detail?.name ?? props.s.client },
    }).onOk((cfg) => applyRtpOut(cfg))
  }
}

// ── apply via REST ────────────────────────────────────────
async function applyRtpIn(cfg) {
  busy.value = true
  const client = props.s.client
  const { formatMode, codec, sampleRate, ...rest } = cfg
  const body = { ...rest }
  if (formatMode === 'manual') {
    body.codec = codec
    body.sampleRate = sampleRate
  } else {
    body.codec = ''
    body.sampleRate = null
  }
  try {
    const res = await fetch(`${apiBase}/api/streams/rtp/${client}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(data.error ?? 'start failed')
    emit('refresh', client)
  } catch (e) {
    console.error('[stream] applyRtpIn failed', e)
  } finally {
    busy.value = false
  }
}

async function applyRtpOut({ protocol, codec, bitrate, sampleRate, channels, host, port }) {
  busy.value = true
  const client = props.s.client
  const body = { protocol, codec, sampleRate, channels }
  if (codec !== 'raw') body.bitrate = bitrate
  try {
    const res = await fetch(`${apiBase}/api/streams/rtp/${client}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(data.error ?? 'start failed')
    if (host && port) {
      await fetch(`${apiBase}/api/streams/rtp/${client}/target`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, port: Number(port) }),
      })
    }
    emit('refresh', client)
  } catch (e) {
    console.error('[stream] applyRtpOut failed', e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <q-card flat style="border: 1px solid #e0e0e0">
    <!-- Header -->
    <q-card-section class="q-py-sm">
      <div class="row no-wrap justify-between items-center">
        <!-- Left: icon + name + address/destination badge -->
        <div class="row items-center no-wrap hdr-left">
          <q-icon
            :name="s.type === 'rtp_in' ? 'download' : 'upload'"
            size="sm"
            :color="s.type === 'rtp_in' ? 'green-7' : 'blue-7'"
            class="q-mr-xs"
          />
          <span class="item-title">{{ detail?.name ?? s.client }}</span>
          <!-- rtp_in: bind port -->
          <template v-if="s.type === 'rtp_in' && detail?.port">
            <span class="bind-addr q-ml-sm">
              {{ detail.address && detail.address !== '0.0.0.0' ? detail.address + ':' : ''
              }}{{ detail.port }}
            </span>
          </template>
          <!-- rtp_out: destination -->
          <template v-else-if="s.type === 'rtp_out' && detail?.target">
            <span class="bind-addr bind-addr--out q-ml-sm">
              {{ detail.target.host }}:{{ detail.target.port }}
            </span>
          </template>
        </div>
        <!-- Right: level meter + edit + delete + play/stop -->
        <div class="row items-center no-wrap">
          <q-btn flat round size="sm" icon="edit" color="grey-6" :disable="busy" @click="openEdit">
            <q-tooltip>설정 수정</q-tooltip>
          </q-btn>
          <q-btn
            flat
            round
            size="md"
            :icon="s.running ? 'stop_circle' : 'play_circle'"
            :color="s.running ? 'negative' : 'positive'"
            :loading="busy"
            @click="toggleStream"
          >
            <q-tooltip>{{ s.running ? 'Stop' : 'Start' }}</q-tooltip>
          </q-btn>
          <LevelMeter
            class="q-ml-sm"
            v-if="displayMeterChannels.length"
            :channels="displayMeterChannels"
            :title="detail?.name ?? s.client"
          />
        </div>
      </div>
    </q-card-section>

    <q-separator />

    <q-card-section class="q-pa-none">
      <RtpInPanel
        v-if="s.type === 'rtp_in'"
        :s="s"
        :detail="detail"
        :busy="busy"
        @refresh="emit('refresh', s.client)"
        @edit="openEdit"
      />
      <RtpOutPanel
        v-else
        :s="s"
        :detail="detail"
        :busy="busy"
        @refresh="emit('refresh', s.client)"
        @edit="openEdit"
      />
    </q-card-section>
  </q-card>
</template>

<style scoped>
.hdr-left {
  gap: 4px;
  min-width: 0;
  flex: 1;
  overflow: hidden;
}
.item-title {
  font-size: 14px;
  font-weight: 700;
  color: #37474f;
  white-space: nowrap;
}
.bind-addr {
  font-size: 12px;
  font-family: 'Courier New', monospace;
  font-weight: 600;
  color: #1565c0;
  background: #e3f2fd;
  border: 1px solid #90caf9;
  border-radius: 3px;
  padding: 1px 7px;
  white-space: nowrap;
  flex-shrink: 0;
}
.bind-addr--out {
  color: #6a1b9a;
  background: #f3e5f5;
  border-color: #ce93d8;
}
</style>
