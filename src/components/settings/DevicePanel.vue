<script setup>
import { onMounted } from 'vue'
import { useSettingsStore } from 'src/stores/settings'
import { storeToRefs } from 'pinia'

const store = useSettingsStore()
const { usbPeriod } = storeToRefs(store)
onMounted(() => store.fetchUsb())
</script>

<template>
  <q-card flat bordered>
    <q-card-section class="q-pt-sm q-pb-xs">
      <q-icon name="devices" size="1.5rem" class="q-mr-sm q-pb-xs" />
      <span class="item-title">Device</span>
    </q-card-section>
    <q-separator />
    <q-item>
      <q-item-section>
        <q-item-label class="item-label">USB Audio Buffer</q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-select
          v-model="usbPeriod"
          :options="[
            { label: '128', value: 128 },
            { label: '256', value: 256 },
            { label: '512', value: 512 },
            { label: '1024', value: 1024 },
          ]"
          filled
          dense
          @update:model-value="store.setUsbPeriod"
          emit-value
        />
      </q-item-section>
    </q-item>
  </q-card>
</template>

<style scoped></style>
