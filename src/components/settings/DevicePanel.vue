<script setup>
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from 'src/stores/settings.js'
import { useAoipStore } from 'src/stores/aoip.js'
import { useQuasar } from 'quasar'
import { storeToRefs } from 'pinia'

const { t } = useI18n()
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
        message: t('settings.portConflict', { port: serial.value.tcpPort, name: conflict.name ?? conflict.client }),
      })
      return
    }
  }
  serial.value.enabled = val
  const res = await store.saveSerial({ ...serial.value })
  if (res?.ok) $q.notify({ type: 'positive', message: t('settings.serialSaved') })
  else {
    serial.value.enabled = !val
    $q.notify({ type: 'negative', message: res?.error ?? t('errors.saveFailed') })
  }
}
</script>

<template>
  <q-card flat bordered>
    <q-card-section class="row no-wrap justify-between items-center q-py-sm">
      <div class="row q-gutter-x-sm items-center">
        <q-icon name="cable" size="24px" color="blue-7" />
        <span class="st-panel-title">{{ t('settings.serial') }}</span>
      </div>
      <div class="row items-center">
        <q-spinner v-if="serialLoading || serialSaving" size="24px" color="blue-7" />
        <q-toggle
          class="q-py-none q-my-none"
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
    <q-card-section class="q-gutter-y-sm">
      <div class="row no-wrap justify-between items-center">
        <span class="row-label">{{ t('settings.tcpPort') }}</span>
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
      </div>
      <div class="row no-wrap justify-between items-center">
        <span class="row-label">{{ t('settings.baudRate') }}</span>
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
      <div class="row no-wrap justify-between items-center">
        <span class="row-label">{{ t('settings.dataBits') }}</span>
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
      <div class="row no-wrap justify-between items-center">
        <span class="row-label">{{ t('settings.stopBits') }}</span>
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
      <div class="row no-wrap justify-between items-center">
        <span class="row-label">{{ t('settings.parity') }}</span>
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
