<script setup>
import { onMounted } from 'vue'
import { useSettingsStore } from 'src/stores/settings'

const store = useSettingsStore()
onMounted(() => store.fetchUsb())

async function toggle() {
  const res = await store.setUsb(!store.usbEnabled)
  if (!res?.ok) console.error('[USB] set failed:', res?.error)
}
</script>

<template>
  <q-card flat bordered class="net-card">
    <q-card-section class="section-head">
      <q-icon name="devices" size="16px" class="q-mr-xs" />
      <span class="section-title">Device</span>
    </q-card-section>
    <q-separator />

    <div class="net-row">
      <span class="net-label">USB Audio</span>
      <div class="row items-center q-gutter-sm">
        <q-toggle
          :model-value="store.usbEnabled"
          :disable="store.usbLoading"
          color="blue-7"
          dense
          @update:model-value="toggle"
        />
        <q-spinner v-if="store.usbLoading" size="16px" color="blue-7" />
      </div>
    </div>
  </q-card>
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
  border-bottom: 1px solid #f0f0f0;
}
.net-label {
  width: 110px;
  font-size: 12px;
  font-weight: 600;
  color: #546e7a;
  flex-shrink: 0;
}
</style>
