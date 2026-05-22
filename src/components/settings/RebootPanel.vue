<script setup>
import { computed } from 'vue'
import { useAoipStore } from 'src/stores/aoip'
import { useSettingsStore } from 'src/stores/settings'
import { useQuasar } from 'quasar'

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
    title: 'Confirm Reboot',
    message: 'The device will reboot. Are you sure?',
    cancel: { flat: true, label: 'Cancel', color: 'grey-7' },
    ok: { unelevated: true, label: 'Reboot', color: 'red-7' },
    persistent: true,
  }).onOk(() => {
    store.reboot()
    $q.notify({ type: 'warning', message: 'Rebooting...' })
  })
}
</script>

<template>
  <q-card flat bordered>
    <q-card-section class="row no-wrap justify-between items-center q-px-lg q-py-md">
      <div class="row q-gutter-x-xs row justify-start items-center">
        <q-icon name="settings_power" size="20px" color="red-7" />
        <span class="st-panel-title">System</span>
      </div>
    </q-card-section>
    <q-separator />

    <q-card-section>
      <div class="row no-wrap justify-between items-center q-px-md q-my-sm">
        <span class="row-label">Engine</span>
        <q-badge
          v-if="engineReady !== null"
          outline
          :color="engineReady ? 'positive' : 'warning'"
          >{{ engineReady ? 'Running' : 'Stopped' }}</q-badge
        >
      </div>
      <div class="row no-wrap justify-between items-center q-px-md q-my-sm">
        <span class="row-label">Engine Uptime</span>
        <span class="uptime-val">{{ fmtUptime(engineSec) }}</span>
      </div>
    </q-card-section>

    <q-separator />
    <q-card-section>
      <div class="row no-wrap justify-between items-center q-px-md q-my-sm">
        <span class="row-label">Reboot</span>
        <q-btn unelevated color="red-7" size="md" :disable="store.rebooting" @click="askReboot">
          reboot
        </q-btn>
      </div>
    </q-card-section>
  </q-card>
</template>

<style scoped>
.st-panel {
  background: #fff;
  border: 1px solid #e4e6ea;
  border-radius: 4px;
}
.st-panel-head {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 14px 18px;
}
.st-panel-title {
  font-size: 1rem;
  font-weight: 600;
  color: #37474f;
}

.st-section-label {
  font-size: 11px;
  font-weight: 700;
  color: #90a4ae;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  padding: 10px 18px 5px;
}
.st-strip {
  padding: 8px 18px 12px;
  border-bottom: 1px solid #f0f2f5;
}
.st-strip:last-child {
  border-bottom: none;
}
.st-strip--row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.row-label {
  font-size: 13px;
  font-weight: 600;
  color: #546e7a;
  width: 110px;
  flex-shrink: 0;
}
.uptime-val {
  font-size: 13px;
  font-weight: 500;
  color: #37474f;
  font-variant-numeric: tabular-nums;
  font-family: 'Courier New', monospace;
}
</style>
