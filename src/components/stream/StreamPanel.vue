<script setup>
import { computed, ref } from 'vue'
import { api } from 'src/boot/axios'
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
})

const aoipState = useAoipStore()
const $q = useQuasar()

const meterChannels = computed(() => {
  const all = props.s.type === 'rtp_in' ? aoipState.channels.inputs : aoipState.channels.outputs
  const matched = all.filter((ch) => ch.label.toLowerCase().includes('stream'))
  return (matched.length ? matched : all).map((ch) => ({ level: ch.level, muted: ch.muted, label: ch.label }))
})

const emit = defineEmits(['refresh'])
const busy = ref(false)

function toggleStream() {
  if (props.s.running) {
    $q.dialog({
      title: '스트림 정지',
      message: `"${props.detail?.name ?? props.s.client}" 스트림을 정지하시겠습니까?`,
      cancel: { flat: true, label: '취소' },
      ok: { unelevated: true, label: '정지', color: 'negative' },
      persistent: true,
    }).onOk(async () => {
      busy.value = true
      try {
        await api.post(`/streams/rtp/${props.s.client}/stop`)
        emit('refresh', props.s.client)
      } catch (e) {
        console.error('[stream] stop failed', e)
      } finally {
        busy.value = false
      }
    })
  } else if (props.s.type === 'rtp_in') {
    $q.dialog({
      component: RtpInStartDialog,
      componentProps: { detail: props.detail, name: props.detail?.name ?? props.s.client },
    }).onOk(async (cfg) => {
      busy.value = true
      try {
        await api.post(`/streams/rtp/${props.s.client}/start`, cfg)
        emit('refresh', props.s.client)
      } catch (e) {
        console.error('[stream] start failed', e)
      } finally {
        busy.value = false
      }
    })
  } else {
    $q.dialog({
      component: RtpOutStartDialog,
      componentProps: { detail: props.detail, name: props.detail?.name ?? props.s.client },
    }).onOk(async ({ protocol, codec, bitrate }) => {
      busy.value = true
      try {
        await api.put(`/streams/rtp/${props.s.client}/codec`, { codec, bitrate })
        await api.put(`/streams/rtp/${props.s.client}/config`, { protocol })
        await api.post(`/streams/rtp/${props.s.client}/start`)
        emit('refresh', props.s.client)
      } catch (e) {
        console.error('[stream] start failed', e)
      } finally {
        busy.value = false
      }
    })
  }
}
</script>

<template>
  <q-card flat style="border: 1px solid #e0e0e0">
    <!-- Header -->
    <q-card-section class="q-py-sm">
      <div class="row no-wrap justify-between items-center q-gutter-x-sm">
        <div class="q-gutter-x-sm">
          <q-icon
            :name="s.type === 'rtp_in' ? 'download' : 'upload'"
            size="sm"
            :color="s.type === 'rtp_in' ? 'green-7' : 'blue-7'"
          />
          <span class="item-title">{{ detail?.name ?? s.client }}</span>
          <template v-if="s.type === 'rtp_in'">
            <q-badge v-if="detail?.address && detail.address !== '0.0.0.0'" outline color="primary">
              {{ detail.address }}:{{ detail.port }}
            </q-badge>
            <q-badge v-else-if="detail?.port" outline color="puple">:{{ detail.port }}</q-badge>
            <q-badge v-if="detail?.protocol" outline color="green">{{
              detail.protocol.toUpperCase()
            }}</q-badge>
          </template>
        </div>
        <div class="row">
          <LevelMeter v-if="meterChannels.length" :channels="meterChannels" />
          <q-btn
            flat
            round
            size="md"
            :icon="s.running ? 'stop_circle' : 'play_circle'"
            :color="s.running ? 'negative' : 'positive'"
            :loading="busy"
            @click="toggleStream"
          >
            <q-tooltip>
              {{ s.running ? 'Stop' : 'Start' }}
            </q-tooltip>
          </q-btn>
        </div>
      </div>
    </q-card-section>
    <q-separator />
    <q-card-section class="q-pa-none">
      <RtpInPanel
        v-if="s.type === 'rtp_in'"
        :s="s"
        :detail="detail"
        @refresh="emit('refresh', s.client)"
      />
      <RtpOutPanel v-else :s="s" :detail="detail" @refresh="emit('refresh', s.client)" />
    </q-card-section>
  </q-card>
</template>

<style scoped></style>
