<script setup>
import { computed } from 'vue'
import { useAoipStore } from 'src/stores/aoip'
import { useChannelPanel } from 'src/composables/useChannelPanel'
import InputPanel from 'src/components/mixer/InputPanel.vue'
import OutputPanel from 'src/components/mixer/OutputPanel.vue'

const aoipState = useAoipStore()

const { channelSections: inputSections } = useChannelPanel('input')
const { channelSections: outputSections } = useChannelPanel('output')

const ORDER = ['Analog', 'Stream', 'AES67', 'Other']
const interfaceTypes = computed(() => {
  const titles = new Set([
    ...inputSections.value.map((s) => s.title),
    ...outputSections.value.map((s) => s.title),
  ])
  return ORDER.filter((t) => titles.has(t))
})
</script>

<template>
  <q-page>
    <div v-if="!aoipState.connected" class="row justify-center q-mt-xl">
      <q-chip color="negative" text-color="white" icon="wifi_off">lost connection</q-chip>
    </div>

    <div v-else class="q-pa-md">
      <div v-for="type in interfaceTypes" :key="type" class="row q-gutter-md q-mb-md">
        <div class="col panel-col">
          <InputPanel :section-title="type" style="width:100%" />
        </div>
        <div class="col panel-col">
          <OutputPanel :section-title="type" style="width:100%" />
        </div>
      </div>
    </div>
  </q-page>
</template>

<style scoped>
.panel-col {
  max-width: 560px;
}
</style>
