<script setup>
import { onMounted } from 'vue'
import { useSettingsStore } from 'src/stores/settings'
import { storeToRefs } from 'pinia'

const store = useSettingsStore()
const { usbEnabled, usbConnected, usbLoading, usbPeriod } = storeToRefs(store)
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

    <!-- Enable/Disable toggle -->
    <div class="row no-wrap justify-between items-center q-px-md q-py-sm q-gutter-x-md">
      <div class="row no-wrap items-center q-gutter-x-sm">
        <span class="row-label">Enable</span>
        <span class="usb-conn-dot" :class="usbConnected ? 'usb-conn-dot--on' : 'usb-conn-dot--off'" />
        <span class="usb-conn-label" :class="usbConnected ? 'usb-conn-label--on' : 'usb-conn-label--off'">
          {{ usbConnected ? 'Connected' : 'Disconnected' }}
        </span>
      </div>
      <q-toggle
        :model-value="usbEnabled"
        :loading="usbLoading"
        color="blue-7"
        dense
        @update:model-value="store.setUsb"
      />
    </div>

    <q-separator inset />

    <!-- Buffer Size -->
    <div class="row no-wrap justify-between items-center q-px-md q-py-sm q-gutter-x-md">
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
.usb-conn-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.usb-conn-dot--on  { background: #43a047; box-shadow: 0 0 0 2px #c8e6c9; }
.usb-conn-dot--off { background: #bdbdbd; }

.usb-conn-label { font-size: 11px; font-weight: 600; }
.usb-conn-label--on  { color: #2e7d32; }
.usb-conn-label--off { color: #9e9e9e; }

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
