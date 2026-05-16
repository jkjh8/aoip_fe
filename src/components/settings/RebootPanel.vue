<script setup>
import { ref, computed } from 'vue'
import { useAoipStore } from 'src/stores/aoip'
import { useSettingsStore } from 'src/stores/settings'
import { useQuasar } from 'quasar'

const aoipState = useAoipStore()
const store = useSettingsStore()
const $q = useQuasar()
const confirm = ref(false)

const engineReady = computed(() => aoipState.engine.ready ?? aoipState.engine.running ?? null)
const engineSec   = computed(() => aoipState.engine.uptime ?? null)

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

function doReboot() {
  confirm.value = false
  store.reboot()
  $q.notify({ type: 'warning', message: 'Rebooting...' })
}
</script>

<template>
  <div class="st-panel">
    <div class="row no-wrap items-center q-px-lg q-py-md q-gutter-xs">
      <q-icon name="settings_power" size="1.2rem" color="red-7" style="padding-top: 4px" />
      <span class="st-panel-title">System</span>
    </div>
    <q-separator />

    <div class="st-section-label">Status</div>
    <div class="row no-wrap justify-between items-center q-px-md q-my-sm">
      <span class="row-label">Engine</span>
      <q-badge
        v-if="engineReady !== null"
        outline
        :color="engineReady ? 'positive' : 'warning'"
      >{{ engineReady ? 'Running' : 'Stopped' }}</q-badge>
    </div>
    <div class="row no-wrap justify-between items-center q-px-md q-my-sm">
      <span class="row-label">Engine Uptime</span>
      <span class="uptime-val">{{ fmtUptime(engineSec) }}</span>
    </div>

    <div class="st-section-label">Power</div>
    <div class="row no-wrap justify-between items-center q-px-md q-my-sm">
      <span class="row-label">Reboot</span>
      <q-btn
        flat
        dense
        round
        icon="power_settings_new"
        color="red-7"
        size="md"
        :disable="store.rebooting"
        @click="confirm = true"
      >
        <q-tooltip
          class="bg-grey-4 text-grey-9"
          anchor="top middle"
          self="bottom middle"
          :offset="[0, 4]"
          >Reboot device</q-tooltip
        >
      </q-btn>
    </div>
  </div>

  <!-- Confirm dialog -->
  <q-dialog v-model="confirm">
    <q-card style="min-width: 280px">
      <q-card-section class="dialog-head">
        <q-icon name="warning" color="red-7" size="20px" />
        <span class="dialog-title">Confirm Reboot</span>
      </q-card-section>
      <q-separator />
      <q-card-section class="dialog-body"> The device will reboot. Are you sure? </q-card-section>
      <q-separator />
      <q-card-actions align="right" class="q-px-md q-pb-sm">
        <q-btn flat label="Cancel" color="grey-7" v-close-popup />
        <q-btn unelevated label="Reboot" color="red-7" @click="doReboot" />
      </q-card-actions>
    </q-card>
  </q-dialog>
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

.dialog-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
}
.dialog-title {
  font-size: 15px;
  font-weight: 700;
  color: #37474f;
}
.dialog-body {
  padding: 12px 20px;
  font-size: 14px;
  color: #546e7a;
}
</style>
