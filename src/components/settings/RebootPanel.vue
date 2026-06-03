<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAoipStore } from 'src/stores/aoip'
import { useSettingsStore } from 'src/stores/settings'
import { useQuasar } from 'quasar'

const { t } = useI18n()
const aoipState = useAoipStore()
const store = useSettingsStore()
const $q = useQuasar()

const engineReady = computed(() => aoipState.engine.ready ?? aoipState.engine.running ?? null)
const engineSec = computed(() => aoipState.engine.uptime ?? null)

function fmtUptime(sec) {
  if (sec == null) return '—'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
}

function askReboot() {
  $q.dialog({
    title: t('settings.confirmReboot'),
    message: t('settings.rebootMessage'),
    cancel: { flat: true, label: t('common.cancel'), color: 'grey-7' },
    ok: { unelevated: true, label: t('settings.reboot'), color: 'red-7' },
    persistent: true,
  }).onOk(() => {
    store.reboot()
    $q.notify({ type: 'warning', message: t('settings.rebooting') })
  })
}
</script>

<template>
  <q-card flat bordered>
    <q-card-section class="row no-wrap justify-between items-center">
      <div class="row q-gutter-x-xs row justify-start items-center">
        <q-icon name="settings_power" size="20px" color="red-7" />
        <span class="st-panel-title">{{ t('settings.system') }}</span>
      </div>
    </q-card-section>
    <q-separator />

    <q-card-section>
      <div class="row no-wrap justify-between items-center">
        <span class="row-label">{{ t('settings.engine') }}</span>
        <q-badge
          v-if="engineReady !== null"
          outline
          :color="engineReady ? 'positive' : 'warning'"
          >{{ engineReady ? t('common.running') : t('common.stopped') }}</q-badge
        >
      </div>
      <div class="row no-wrap justify-between items-center q-mt-md">
        <span class="row-label">{{ t('settings.engineUptime') }}</span>
        <span class="uptime-val">{{ fmtUptime(engineSec) }}</span>
      </div>
    </q-card-section>

    <q-separator />
    <q-card-section>
      <div class="row no-wrap justify-between items-center">
        <span class="row-label">{{ t('settings.reboot') }}</span>
        <q-btn
          unelevated
          color="red-7"
          size="md"
          :disable="store.rebooting"
          @click="askReboot"
          :label="t('settings.reboot')"
        />
      </div>
    </q-card-section>
  </q-card>
</template>

<style scoped>
.uptime-val {
  font-size: 13px;
  font-weight: 500;
  color: #37474f;
  font-variant-numeric: tabular-nums;
  font-family: 'Courier New', monospace;
}
</style>
