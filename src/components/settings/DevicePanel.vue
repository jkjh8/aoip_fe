<script setup>
import { onMounted } from 'vue'
import { useSettingsStore } from 'src/stores/settings.js'
import { useAoipStore } from 'src/stores/aoip.js'
import { useQuasar } from 'quasar'
import { storeToRefs } from 'pinia'

const store = useSettingsStore()
const aoipStore = useAoipStore()
const $q = useQuasar()
const { serial, serialLoading, serialSaving } = storeToRefs(store)

const baudRateOptions = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200]
const dataBitsOptions = [7, 8]
const stopBitsOptions = [1, 2]
const parityOptions = [
  { label: 'None', value: 'none' },
  { label: 'Even', value: 'even' },
  { label: 'Odd', value: 'odd' },
]

onMounted(() => store.fetchSerial())

async function toggle(val) {
  if (val) {
    const conflict = (aoipStore.streams?.inputs ?? []).find((s) => s.port === serial.value.tcpPort)
    if (conflict) {
      $q.notify({
        type: 'negative',
        message: `Port ${serial.value.tcpPort} is already used by RTP In stream "${conflict.name ?? conflict.client}".`,
        position: 'top',
      })
      return
    }
  }
  serial.value.enabled = val
  const res = await store.saveSerial({ ...serial.value })
  if (res?.ok) $q.notify({ type: 'positive', message: 'Serial settings saved.', position: 'top' })
  else {
    serial.value.enabled = !val
    $q.notify({ type: 'negative', message: res?.error ?? 'Failed to save', position: 'top' })
  }
}
</script>

<template>
  <q-card flat bordered>
    <q-card-section class="row no-wrap justify-between items-center q-px-lg q-py-sm">
      <div class="row q-gutter-x-xs items-center">
        <q-icon name="cable" size="20px" color="blue-7" />
        <span class="st-panel-title">RS232 Serial Server</span>
      </div>
      <div class="row items-center q-gutter-x-sm">
        <q-spinner v-if="serialLoading || serialSaving" size="16px" color="blue-7" />
        <q-toggle
          :model-value="serial.enabled"
          :disable="serialSaving"
          size="lg"
          color="blue-7"
          unchecked-icon="clear"
          checked-icon="check"
          @update:model-value="toggle"
        />
      </div>
    </q-card-section>
    <q-separator />
    <q-card-section
      class="row no-wrap justify-between items-center q-px-md q-gutter-x-md q-my-none"
    >
      <span class="row-label">TCP Port</span>
      <q-input
        v-model.number="serial.tcpPort"
        :disable="serial.enabled"
        type="number"
        min="1"
        max="65535"
        dense
        outlined
        hide-bottom-space
        class="input-width"
      />
    </q-card-section>
    <q-separator />
    <q-card-section class="q-px-md q-gutter-x-md q-my-none">
      <div class="row no-wrap justify-between items-center">
        <span class="row-label">Baud Rate</span>
        <q-select
          v-model="serial.baudRate"
          :options="baudRateOptions"
          :disable="serial.enabled"
          dense
          outlined
          hide-bottom-space
          class="input-width"
        />
      </div>
      <div class="row no-wrap justify-between items-center q-mt-sm">
        <span class="row-label">Data Bits</span>
        <q-select
          v-model="serial.dataBits"
          :options="dataBitsOptions"
          :disable="serial.enabled"
          dense
          outlined
          hide-bottom-space
          class="input-width"
        />
      </div>
      <div class="row no-wrap justify-between items-center q-mt-sm">
        <span class="row-label">Stop Bits</span>
        <q-select
          v-model="serial.stopBits"
          :options="stopBitsOptions"
          :disable="serial.enabled"
          dense
          outlined
          hide-bottom-space
          class="input-width"
        />
      </div>
      <div class="row no-wrap justify-between items-center q-mt-sm">
        <span class="row-label">Parity</span>
        <q-select
          v-model="serial.parity"
          :options="parityOptions"
          option-value="value"
          option-label="label"
          emit-value
          map-options
          :disable="serial.enabled"
          dense
          outlined
          hide-bottom-space
          class="input-width"
        />
      </div>
    </q-card-section>
  </q-card>
</template>

<style scoped>
:deep(.row-input .q-field__control) {
  min-height: 28px !important;
  height: 28px;
}
:deep(.row-input .q-field__native) {
  padding: 0;
  min-height: 28px;
}
.input-width {
  width: 183px;
}
</style>
