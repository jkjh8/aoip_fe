<script setup>
import { ref } from 'vue'
import { useSettingsStore } from 'src/stores/settings'
import { useQuasar } from 'quasar'

const store = useSettingsStore()
const $q = useQuasar()
const confirm = ref(false)

function doReboot() {
  confirm.value = false
  store.reboot()
  $q.notify({ type: 'warning', message: 'Rebooting...' })
}
</script>

<template>
  <q-card flat bordered class="net-card">
    <q-card-section class="section-head">
      <q-icon name="settings_power" size="16px" class="q-mr-xs" />
      <span class="section-title">System</span>
    </q-card-section>
    <q-separator />

    <div class="net-row">
      <span class="net-label">Reboot</span>
      <q-btn round flat color="red-7" icon="power_settings_new" size="sm"
        :disable="store.rebooting"
        @click="confirm = true" />
    </div>
  </q-card>

  <q-dialog v-model="confirm">
    <q-card style="min-width:280px">
      <q-card-section class="row items-center q-pb-none">
        <q-icon name="warning" color="red-7" size="22px" class="q-mr-sm" />
        <span class="text-subtitle2">Confirm Reboot</span>
      </q-card-section>
      <q-card-section>The device will reboot. Are you sure?</q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="Cancel" v-close-popup />
        <q-btn flat label="Reboot" color="red-7" @click="doReboot" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.net-card { border-radius: 8px; }
.section-head {
  display: flex;
  align-items: center;
  padding: 10px 16px;
}
.section-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: #455a64;
}
.net-row {
  display: flex;
  align-items: center;
  padding: 7px 16px;
}
.net-label {
  width: 110px;
  font-size: 12px;
  font-weight: 600;
  color: #546e7a;
  flex-shrink: 0;
}
</style>
