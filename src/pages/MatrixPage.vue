<script setup>
import { aoipState } from 'src/boot/socket'
import InputPanel from 'src/components/mixer/InputPanel.vue'
import OutputPanel from 'src/components/mixer/OutputPanel.vue'
</script>

<template>
  <q-page>
    <div v-if="!aoipState.connected" class="row justify-center q-mt-xl">
      <q-chip color="negative" text-color="white" icon="wifi_off">백엔드 연결 끊김</q-chip>
    </div>

    <div v-else class="panels-row q-pa-md">
      <InputPanel />
      <OutputPanel />
    </div>
  </q-page>
</template>

<style scoped>
.panels-row {
  display: flex;
  justify-content: center;
  align-items: flex-start;
}
</style>
