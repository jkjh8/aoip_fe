<script setup>
import NetworkPanel from 'src/components/settings/NetworkPanel.vue'
import DevicePanel from 'src/components/settings/DevicePanel.vue'
import RebootPanel from 'src/components/settings/RebootPanel.vue'
</script>

<template>
  <q-page class="q-pa-md">
    <div class="settings-grid">
      <NetworkPanel />
      <DevicePanel />
      <RebootPanel />
    </div>
  </q-page>
</template>

<style scoped>
.settings-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 520px;
}
</style>
