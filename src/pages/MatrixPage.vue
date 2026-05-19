<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { useQuasar } from 'quasar'
import { socket } from 'src/boot/socket'
import { useAoipStore } from 'src/stores/aoip'
import { useChannelPanel } from 'src/composables/useChannelPanel'
import InputPanel from 'src/components/mixer/InputPanel.vue'
import OutputPanel from 'src/components/mixer/OutputPanel.vue'
import MatrixAes67Input from 'src/components/mixer/MatrixAes67Input.vue'
import MatrixAes67Output from 'src/components/mixer/MatrixAes67Output.vue'
import RtpInStartDialog from 'src/components/stream/RtpInStartDialog.vue'
import RtpOutStartDialog from 'src/components/stream/RtpOutStartDialog.vue'

const aoipState = useAoipStore()
const $q = useQuasar()

const { channelSections: inputSections } = useChannelPanel('input')
const { channelSections: outputSections } = useChannelPanel('output')

const ORDER = ['Analog', 'Stream', 'AES67', 'Other']
const interfaceTypes = computed(() => {
  const titles = new Set([
    ...inputSections.value.map((s) => s.title),
    ...outputSections.value.map((s) => s.title),
  ])
  return ORDER.filter((t) => titles.has(t))
})

// ── Stream management ─────────────────────────────────────
const apiBase = process.env.DEV
  ? 'http://192.168.10.103:3000'
  : `${window.location.protocol}//${window.location.hostname}:3000`

const streamDetails = ref({})

function fetchStreamDetail(client) {
  socket.emit('rtp:stream:get', { client }, (res) => {
    if (res?.ok && res.stream) streamDetails.value[client] = res.stream
  })
}

onMounted(() => {
  const all = [...(aoipState.streams?.inputs ?? []), ...(aoipState.streams?.outputs ?? [])]
  for (const s of all) fetchStreamDetail(s.client)
})

watch(
  () => [...(aoipState.streams?.inputs ?? []), ...(aoipState.streams?.outputs ?? [])]
    .map((s) => s.client).join(','),
  (clients) => {
    if (!clients) return
    for (const client of clients.split(',')) {
      if (!streamDetails.value[client]) fetchStreamDetail(client)
    }
  },
  { immediate: true },
)

const allInputStreams = computed(() => aoipState.streams?.inputs ?? [])
const allOutputStreams = computed(() => aoipState.streams?.outputs ?? [])


// ── Activate (start inactive) ─────────────────────────────
function activateInputStream(s) {
  $q.dialog({
    component: RtpInStartDialog,
    componentProps: { detail: streamDetails.value[s.client] ?? {}, name: streamDetails.value[s.client]?.name ?? s.client },
  }).onOk(async (cfg) => {
    const { formatMode, codec, sampleRate, ...rest } = cfg
    const body = { ...rest }
    if (formatMode === 'manual') { body.codec = codec; body.sampleRate = sampleRate }
    else { body.codec = ''; body.sampleRate = null }
    try {
      const res = await fetch(`${apiBase}/api/streams/rtp/${s.client}/start`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.ok) fetchStreamDetail(s.client)
      else $q.notify({ type: 'negative', message: data.error ?? '시작 실패' })
    } catch (e) { console.error('[stream] activate in failed', e) }
  })
}

function activateOutputStream(s) {
  $q.dialog({
    component: RtpOutStartDialog,
    componentProps: { detail: streamDetails.value[s.client] ?? {}, name: streamDetails.value[s.client]?.name ?? s.client },
  }).onOk(async ({ protocol, codec, bitrate, sampleRate, channels, host, port }) => {
    const body = { protocol, codec, sampleRate, channels }
    if (codec !== 'raw') body.bitrate = bitrate
    try {
      const res = await fetch(`${apiBase}/api/streams/rtp/${s.client}/start`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.ok) { $q.notify({ type: 'negative', message: data.error ?? '시작 실패' }); return }
      if (host && port) {
        await fetch(`${apiBase}/api/streams/rtp/${s.client}/target`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ host, port: Number(port) }),
        })
      }
      fetchStreamDetail(s.client)
    } catch (e) { console.error('[stream] activate out failed', e) }
  })
}

// ── Edit active stream ────────────────────────────────────
function editInputStream(stream) {
  $q.dialog({
    component: RtpInStartDialog,
    componentProps: { detail: streamDetails.value[stream.client] ?? {}, name: streamDetails.value[stream.client]?.name ?? stream.client },
  }).onOk(async (cfg) => {
    const { formatMode, codec, sampleRate, ...rest } = cfg
    const body = { ...rest }
    if (formatMode === 'manual') { body.codec = codec; body.sampleRate = sampleRate }
    else { body.codec = ''; body.sampleRate = null }
    try {
      const res = await fetch(`${apiBase}/api/streams/rtp/${stream.client}/start`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.ok) fetchStreamDetail(stream.client)
      else $q.notify({ type: 'negative', message: data.error ?? '설정 실패' })
    } catch (e) { console.error('[stream] edit in failed', e) }
  })
}

function editOutputStream(stream) {
  $q.dialog({
    component: RtpOutStartDialog,
    componentProps: { detail: streamDetails.value[stream.client] ?? {}, name: streamDetails.value[stream.client]?.name ?? stream.client },
  }).onOk(async ({ protocol, codec, bitrate, sampleRate, channels, host, port }) => {
    const body = { protocol, codec, sampleRate, channels }
    if (codec !== 'raw') body.bitrate = bitrate
    try {
      const res = await fetch(`${apiBase}/api/streams/rtp/${stream.client}/start`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.ok) { $q.notify({ type: 'negative', message: data.error ?? '설정 실패' }); return }
      if (host && port) {
        await fetch(`${apiBase}/api/streams/rtp/${stream.client}/target`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ host, port: Number(port) }),
        })
      }
      fetchStreamDetail(stream.client)
    } catch (e) { console.error('[stream] edit out failed', e) }
  })
}

// ── Stop active stream ────────────────────────────────────
function stopInputStream(stream) {
  const name = streamDetails.value[stream.client]?.name ?? stream.client
  $q.dialog({
    title: '스트림 중지', message: `"${name}" 스트림을 중지하시겠습니까?`,
    cancel: { flat: true, label: '취소' },
    ok: { unelevated: true, label: '중지', color: 'negative' },
    persistent: true,
  }).onOk(() => {
    socket.emit('rtp:stream:stop', { client: stream.client }, (res) => {
      if (!res?.ok) $q.notify({ type: 'negative', message: res?.error ?? '중지 실패' })
    })
  })
}

function stopOutputStream(stream) {
  const name = streamDetails.value[stream.client]?.name ?? stream.client
  $q.dialog({
    title: '스트림 중지', message: `"${name}" 스트림을 중지하시겠습니까?`,
    cancel: { flat: true, label: '취소' },
    ok: { unelevated: true, label: '중지', color: 'negative' },
    persistent: true,
  }).onOk(() => {
    socket.emit('rtp:stream:stop', { client: stream.client }, (res) => {
      if (!res?.ok) $q.notify({ type: 'negative', message: res?.error ?? '중지 실패' })
    })
  })
}

// ── Delete stream (from inactive menu) ───────────────────
function removeStream(client) {
  const name = streamDetails.value[client]?.name ?? client
  $q.dialog({
    title: '스트림 삭제', message: `"${name}" 스트림을 삭제하시겠습니까?`,
    cancel: { flat: true, label: '취소' },
    ok: { unelevated: true, label: '삭제', color: 'negative' },
    persistent: true,
  }).onOk(() => {
    socket.emit('rtp:stream:delete', { client }, (res) => {
      if (!res?.ok) $q.notify({ type: 'negative', message: res?.error ?? '삭제 실패' })
      else delete streamDetails.value[client]
    })
  })
}
</script>

<template>
  <q-page>
    <div v-if="!aoipState.connected" class="row justify-center q-mt-xl">
      <q-chip color="negative" text-color="white" icon="wifi_off">lost connection</q-chip>
    </div>

    <div v-else class="q-pa-md">
      <div v-for="type in interfaceTypes" :key="type" class="row q-gutter-md q-mb-md">

        <!-- AES67: per-card rendering -->
        <template v-if="type === 'AES67'">
          <div class="col panel-col panel-col--sticky">
            <MatrixAes67Input style="width:100%" />
          </div>
          <div class="col panel-col">
            <MatrixAes67Output style="width:100%" />
          </div>
        </template>

        <!-- Stream: enhanced panels with activate/edit/stop -->
        <template v-else-if="type === 'Stream'">
          <div class="col panel-col panel-col--sticky">
            <InputPanel
              section-title="Stream"
              style="width:100%"
              :all-streams="allInputStreams"
              :stream-details="streamDetails"
              @activate-stream="activateInputStream"
              @remove-stream="removeStream"
              @edit-stream="editInputStream"
              @stop-stream="stopInputStream"
            />
          </div>
          <div class="col panel-col">
            <OutputPanel
              section-title="Stream"
              style="width:100%"
              :all-streams="allOutputStreams"
              :stream-details="streamDetails"
              @activate-stream="activateOutputStream"
              @remove-stream="removeStream"
              @edit-stream="editOutputStream"
              @stop-stream="stopOutputStream"
            />
          </div>
        </template>

        <!-- Analog / Other: unchanged -->
        <template v-else>
          <div class="col panel-col panel-col--sticky">
            <InputPanel :section-title="type" style="width:100%" />
          </div>
          <div class="col panel-col">
            <OutputPanel :section-title="type" style="width:100%" />
          </div>
        </template>

      </div>
    </div>
  </q-page>
</template>

<style scoped>
.panel-col {
  max-width: 560px;
}
.panel-col--sticky {
  position: sticky;
  top: 0;
  align-self: flex-start;
}
</style>
