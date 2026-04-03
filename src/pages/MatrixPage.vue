<script setup>
import { useAoipStore } from 'src/stores/aoip'
const aoipState = useAoipStore()
import InputPanel from 'src/components/mixer/InputPanel.vue'
import OutputPanel from 'src/components/mixer/OutputPanel.vue'
</script>

<template>
  <q-page>
    <div v-if="!aoipState.connected" class="row justify-center q-mt-xl">
      <q-chip color="negative" text-color="white" icon="wifi_off">lost connection</q-chip>
    </div>

    <div v-else class="row justify-center q-pa-md q-gutter-x-md">
      <InputPanel />
      <OutputPanel />
    </div>
  </q-page>
</template>

<style scoped></style>
