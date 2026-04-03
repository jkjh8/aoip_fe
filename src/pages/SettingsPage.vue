<script setup>
import NetworkPanel from 'src/components/settings/NetworkPanel.vue'
import DevicePanel from 'src/components/settings/DevicePanel.vue'
import RebootPanel from 'src/components/settings/RebootPanel.vue'
</script>

<template>
  <q-page class="row justify-center q-pa-md">
    <div class="column q-gutter-md">
      <NetworkPanel />
      <DevicePanel />
      <RebootPanel />
    </div>
  </q-page>
</template>

<style scoped></style>
