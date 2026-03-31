<script setup>
import NetworkPanel from 'src/components/settings/NetworkPanel.vue'
import DevicePanel  from 'src/components/settings/DevicePanel.vue'
import RebootPanel  from 'src/components/settings/RebootPanel.vue'
</script>

<template>
  <q-page class="settings-page">
    <div class="panels-col">
      <NetworkPanel />
      <DevicePanel />
      <RebootPanel />
    </div>
  </q-page>
</template>

<style scoped>
.settings-page {
  background: #f4f6f8;
  min-height: 100vh;
}
.panels-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 24px;
  max-width: 520px;
  margin: 0 auto;
}
</style>
