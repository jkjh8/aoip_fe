<script setup>
import NetworkPanel from 'src/components/settings/NetworkPanel.vue'
import RebootPanel from 'src/components/settings/RebootPanel.vue'
</script>

<template>
  <q-page class="row justify-start q-pa-md">
    <div class="column q-gutter-md" style="width: 100%; max-width: 600px">
      <NetworkPanel />
      <RebootPanel />
    </div>
  </q-page>
</template>

<style scoped></style>
