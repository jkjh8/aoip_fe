<script setup>
import { ref, watch, onMounted } from 'vue'
import { socket } from 'src/boot/socket'
import { useAoipStore } from 'src/stores/aoip'
import StreamPanel from 'src/components/stream/StreamPanel.vue'

const aoipState = useAoipStore()

// ── Detail cache ──────────────────────────────────────────
const details = ref({}) // client → full detail object

function fetchDetail(client) {
  socket.emit('rtp:stream:get', { client }, (res) => {
    if (res?.ok && res.stream) details.value[client] = res.stream
  })
}

onMounted(() => {
  for (const s of aoipState.streams?.rtpStreams ?? []) fetchDetail(s.client)
})

// Fetch detail only when new streams appear
watch(
  () => aoipState.streams?.rtpStreams?.map((s) => s.client).join(','),
  (clients) => {
    if (!clients) return
    for (const client of clients.split(',')) {
      if (!details.value[client]) fetchDetail(client)
    }
  },
)
</script>

<template>
  <q-page class="stream-page">
    <div v-if="!aoipState.connected" class="row justify-center q-mt-xl">
      <q-chip color="negative" text-color="white" icon="wifi_off">lost connection</q-chip>
    </div>

    <template v-else>
      <div class="panels-row">
        <StreamPanel
          v-for="s in (aoipState.streams?.rtpStreams ?? [])"
          :key="s.client"
          :s="s"
          :detail="details[s.client]"
          @refresh="fetchDetail"
        />

        <div v-if="!aoipState.streams?.rtpStreams?.length" class="empty-page">
          <q-icon name="stream" size="40px" color="blue-grey-3" />
          <span>No streams</span>
        </div>
      </div>
    </template>
  </q-page>
</template>

<style scoped>
.stream-page {
  background: #f4f6f8;
  min-height: 100vh;
}

.panels-row {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 24px;
  max-width: 720px;
  margin: 0 auto;
}

.empty-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px 0;
  color: #b0bec5;
  font-size: 14px;
}
</style>
