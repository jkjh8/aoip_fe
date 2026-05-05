<script setup>
import { ref, watch, onMounted } from 'vue'
import { api } from 'src/boot/axios'
import { useAoipStore } from 'src/stores/aoip'
import StreamPanel from 'src/components/stream/StreamPanel.vue'

const aoipState = useAoipStore()

// ── Detail cache ──────────────────────────────────────────
const details = ref({}) // client → full detail object

async function fetchDetail(client) {
  try {
    const res = await api.get(`/streams/rtp/${client}`)
    // 서버가 { ok, stream } 또는 stream 객체 직접 반환 모두 대응
    const data = res.data?.stream ?? res.data
    if (data) details.value[client] = data
  } catch (e) {
    console.error('[stream] fetchDetail failed', e)
  }
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
  <q-page class="row justify-center q-pa-md">
    <div v-if="!aoipState.connected" class="row justify-center q-pa-md">
      <q-chip color="negative" text-color="white" icon="wifi_off">lost connection</q-chip>
    </div>

    <template v-else>
      <div class="column q-gutter-md" style="width: 100%; max-width: 600px">
        <StreamPanel
          v-for="s in aoipState.streams?.rtpStreams ?? []"
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

<style scoped></style>
