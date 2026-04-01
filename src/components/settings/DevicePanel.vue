<script setup>
import { onMounted } from 'vue'
import { useSettingsStore } from 'src/stores/settings'
import { storeToRefs } from 'pinia'

const store = useSettingsStore()
const { usbPeriod } = storeToRefs(store)
onMounted(() => store.fetchUsb())
</script>

<template>
  <div class="st-panel q-pb-sm">
    <div class="row no-wrap items-center q-px-lg q-py-md q-gutter-x-sm">
      <q-icon name="devices" size="20px" color="blue-7" />
      <span class="st-panel-title">Device</span>
    </div>
    <q-separator />

    <div class="st-section-label">USB Audio</div>
    <div class="row no-wrap justify-between items-center q-px-md q-gutter-x-md">
      <span class="row-label">Buffer Size</span>
      <q-select
        v-model="usbPeriod"
        :options="[
          { label: '128', value: 128 },
          { label: '256', value: 256 },
          { label: '512', value: 512 },
          { label: '1024', value: 1024 },
        ]"
        dense
        outlined
        emit-value
        map-options
        class="row-select"
        @update:model-value="store.setUsbPeriod"
      />
    </div>
  </div>
</template>

<style scoped>
.row-select {
  width: 100px;
}
:deep(.row-select .q-field__control) {
  min-height: 28px !important;
  height: 28px;
}
:deep(.row-select .q-field__native) {
  padding: 0;
  min-height: 28px;
}
:deep(.row-select .q-field__append) {
  height: 28px;
  align-self: center;
}
</style>
