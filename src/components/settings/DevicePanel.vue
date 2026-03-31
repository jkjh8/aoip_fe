<script setup>
import { onMounted } from 'vue'
import { useSettingsStore } from 'src/stores/settings'
import { storeToRefs } from 'pinia'

const store = useSettingsStore()
const { usbPeriod } = storeToRefs(store)
onMounted(() => store.fetchUsb())
</script>

<template>
  <div class="st-panel">
    <div class="st-panel-head">
      <q-icon name="devices" size="16px" color="blue-7" />
      <span class="st-panel-title">Device</span>
    </div>
    <q-separator />

    <div class="st-section-label">USB Audio</div>
    <div class="st-strip st-strip--row">
      <span class="row-label">Buffer Size</span>
      <q-select
        v-model="usbPeriod"
        :options="[
          { label: '128',  value: 128  },
          { label: '256',  value: 256  },
          { label: '512',  value: 512  },
          { label: '1024', value: 1024 },
        ]"
        dense outlined
        emit-value
        map-options
        class="row-select"
        @update:model-value="store.setUsbPeriod"
      />
    </div>
  </div>
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
.st-panel-title { font-size: 16px; font-weight: 600; color: #37474f; }

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
.st-strip:last-child { border-bottom: none; }
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
.row-select { width: 120px; }
</style>
