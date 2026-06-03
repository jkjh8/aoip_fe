<script setup>
import { computed } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { socket } from 'src/boot/socket'
import { useAoipStore } from 'src/stores/aoip'
import StreamPanel from 'src/components/stream/StreamPanel.vue'
import RtpInStartDialog from 'src/components/stream/RtpInStartDialog.vue'
import RtpOutStartDialog from 'src/components/stream/RtpOutStartDialog.vue'

const aoipState = useAoipStore()
const $q = useQuasar()
const { t } = useI18n()

const apiBase = process.env.DEV
  ? 'http://192.168.10.103:3000'
  : `${window.location.protocol}//${window.location.hostname}:3000`

// ── panel builders (active only) ─────────────────────────
function buildPanels(type) {
  const streams = type === 'rtp_in'
    ? (aoipState.streams?.inputs  ?? [])
    : (aoipState.streams?.outputs ?? [])
  const allChs = (type === 'rtp_in' ? aoipState.channels.inputs : aoipState.channels.outputs)
    .filter((ch) => ch.label.toLowerCase().includes('stream'))

  let idx = 0
  return streams
    .map((s) => {
      const n = s.channels ?? 2
      const channels = allChs.slice(idx, idx + n)
      idx += n
      return { s, channels }
    })
    .filter(({ s }) => s.running)
}

const rtpInPanels  = computed(() => buildPanels('rtp_in'))
const rtpOutPanels = computed(() => buildPanels('rtp_out'))

// ── inactive streams (for "+" picker) ────────────────────
const inactiveInputs  = computed(() => (aoipState.streams?.inputs  ?? []).filter((s) => !s.running))
const inactiveOutputs = computed(() => (aoipState.streams?.outputs ?? []).filter((s) => !s.running))

// ── activate (start inactive stream) ─────────────────────
function activateStream(s) {
  if (s.type === 'rtp_in') {
    $q.dialog({
      component: RtpInStartDialog,
      componentProps: { detail: s, name: s.name ?? s.client },
    }).onOk(async (cfg) => {
      const { formatMode, codec, sampleRate, ...rest } = cfg
      const body = { ...rest }
      if (formatMode === 'manual') {
        body.codec      = codec
        body.sampleRate = sampleRate
      } else {
        body.codec      = ''
        body.sampleRate = null
      }
      try {
        const res  = await fetch(`${apiBase}/api/streams/rtp/${s.client}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!data.ok) $q.notify({ type: 'negative', message: data.error ?? t('errors.startFailed') })
      } catch (e) {
        console.error('[stream] activate rtp_in failed', e)
      }
    })
  } else {
    $q.dialog({
      component: RtpOutStartDialog,
      componentProps: { detail: s, name: s.name ?? s.client },
    }).onOk(async ({ protocol, codec, bitrate, sampleRate, channels, host, port }) => {
      const body = { protocol, codec, sampleRate, channels }
      if (codec !== 'raw') body.bitrate = bitrate
      try {
        const res  = await fetch(`${apiBase}/api/streams/rtp/${s.client}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!data.ok) {
          $q.notify({ type: 'negative', message: data.error ?? t('errors.startFailed') })
          return
        }
        if (host && port) {
          await fetch(`${apiBase}/api/streams/rtp/${s.client}/target`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host, port: Number(port) }),
          })
        }
      } catch (e) {
        console.error('[stream] activate rtp_out failed', e)
      }
    })
  }
}

// ── delete stream ─────────────────────────────────────────
function removeStream(client) {
  const s = [...(aoipState.streams?.inputs ?? []), ...(aoipState.streams?.outputs ?? [])]
    .find((s) => s.client === client)
  const name = s?.name ?? client
  $q.dialog({
    title: t('stream.dialogs.deleteTitle'),
    message: t('stream.dialogs.deleteMessage', { name }),
    cancel: { flat: true, label: t('common.cancel') },
    ok: { unelevated: true, label: t('common.delete'), color: 'negative' },
    persistent: true,
  }).onOk(() => {
    socket.emit('rtp:stream:delete', { client }, (res) => {
      if (!res?.ok) $q.notify({ type: 'negative', message: res?.error ?? t('errors.deleteFailed') })
    })
  })
}
</script>

<template>
  <q-page>
    <div v-if="!aoipState.connected" class="row justify-center q-pa-md q-mt-xl">
      <q-chip color="negative" text-color="white" icon="wifi_off">{{ t('errors.lostConnection') }}</q-chip>
    </div>

    <div v-else class="row q-pa-md q-gutter-md items-start">
      <!-- RTP IN -->
      <div class="col stream-col">
        <div class="col-label">
          <q-icon name="download" size="16px" color="green-7" />
          {{ t('stream.input') }}
          <q-btn
            flat round dense size="xs"
            icon="add"
            color="green-7"
            style="margin-left: auto; margin-right: -4px"
          >
            <q-tooltip>{{ t('stream.activate') }}</q-tooltip>
            <q-menu>
              <q-list style="min-width: 210px">
                <q-item-label header class="text-caption q-py-xs">{{ t('stream.inactiveInputs') }}</q-item-label>
                <template v-if="inactiveInputs.length">
                  <q-item
                    v-for="s in inactiveInputs"
                    :key="s.client"
                    dense clickable v-close-popup
                    @click="activateStream(s)"
                  >
                    <q-item-section>{{ s.name ?? s.client }}</q-item-section>
                    <q-item-section side>
                      <q-btn
                        flat round dense size="xs"
                        icon="delete_outline"
                        color="grey-5"
                        v-close-popup
                        @click.stop="removeStream(s.client)"
                      />
                    </q-item-section>
                  </q-item>
                </template>
                <q-item v-else disable dense>
                  <q-item-section class="text-grey-5 text-caption">{{ t('stream.allActive') }}</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
        <div class="column q-gutter-sm">
          <StreamPanel
            v-for="{ s, channels } in rtpInPanels"
            :key="s.client"
            :s="s"
            :detail="s"
            :meter-channels="channels"

            @remove="removeStream(s.client)"
          />
          <div v-if="!rtpInPanels.length" class="empty-col">
            <q-icon name="stream" size="32px" color="blue-grey-3" />
            <span>{{ t('stream.noActiveInputs') }}</span>
          </div>
        </div>
      </div>

      <!-- RTP OUT -->
      <div class="col stream-col">
        <div class="col-label">
          <q-icon name="upload" size="16px" color="blue-7" />
          {{ t('stream.output') }}
          <q-btn
            flat round dense size="xs"
            icon="add"
            color="blue-7"
            style="margin-left: auto; margin-right: -4px"
          >
            <q-tooltip>{{ t('stream.activate') }}</q-tooltip>
            <q-menu>
              <q-list style="min-width: 210px">
                <q-item-label header class="text-caption q-py-xs">{{ t('stream.inactiveOutputs') }}</q-item-label>
                <template v-if="inactiveOutputs.length">
                  <q-item
                    v-for="s in inactiveOutputs"
                    :key="s.client"
                    dense clickable v-close-popup
                    @click="activateStream(s)"
                  >
                    <q-item-section>{{ s.name ?? s.client }}</q-item-section>
                    <q-item-section side>
                      <q-btn
                        flat round dense size="xs"
                        icon="delete_outline"
                        color="grey-5"
                        v-close-popup
                        @click.stop="removeStream(s.client)"
                      />
                    </q-item-section>
                  </q-item>
                </template>
                <q-item v-else disable dense>
                  <q-item-section class="text-grey-5 text-caption">{{ t('stream.allActive') }}</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
        <div class="column q-gutter-sm">
          <StreamPanel
            v-for="{ s, channels } in rtpOutPanels"
            :key="s.client"
            :s="s"
            :detail="s"
            :meter-channels="channels"

            @remove="removeStream(s.client)"
          />
          <div v-if="!rtpOutPanels.length" class="empty-col">
            <q-icon name="stream" size="32px" color="blue-grey-3" />
            <span>{{ t('stream.noActiveOutputs') }}</span>
          </div>
        </div>
      </div>
    </div>
  </q-page>
</template>

<style scoped>
.stream-col {
  min-width: 360px;
  max-width: 560px;
  flex: 1;
}
.col-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #78909c;
  margin-bottom: 8px;
}
.empty-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 0;
  color: #b0bec5;
  font-size: 13px;
}
</style>
