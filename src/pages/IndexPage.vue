<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAoipStore } from 'src/stores/aoip'
import { useChannelPanel } from 'src/composables/useChannelPanel'
import InputPanelV from 'src/components/mixer/InputPanelV.vue'
import OutputPanelV from 'src/components/mixer/OutputPanelV.vue'

const aoipState = useAoipStore()
const { t } = useI18n()

const { channelSections: inputSections } = useChannelPanel('input')
const { channelSections: outputSections } = useChannelPanel('output')

const ORDER = ['Analog', 'USB', 'Stream', 'AES67', 'Other']
const interfaceTypes = computed(() => {
  const titles = new Set([
    ...inputSections.value.map((s) => s.title),
    ...outputSections.value.map((s) => s.title),
  ])
  return ORDER.filter((t) => titles.has(t))
})

const COLLAPSIBLE_TYPES = new Set(['USB', 'Stream', 'AES67'])
const collapsed = ref({})
function toggleCollapsed(type) {
  collapsed.value[type] = !collapsed.value[type]
}

</script>

<template>
  <q-page>
    <div v-if="!aoipState.connected" class="row justify-center q-mt-xl">
      <q-chip color="negative" text-color="white" icon="wifi_off">{{
        t('errors.lostConnection')
      }}</q-chip>
    </div>

    <div v-else class="q-pa-md column q-gutter-md">
      <!-- INPUT 영역 -->
      <div>
        <div class="row items-center q-mb-sm q-gutter-sm">
          <q-item-label overline class="text-deep-orange-8 area-label">INPUT</q-item-label>
          <q-separator vertical />
          <template v-for="type in interfaceTypes" :key="`toggle-in-${type}`">
            <q-btn
              v-if="COLLAPSIBLE_TYPES.has(type)"
              flat
              dense
              no-caps
              size="sm"
              :icon-right="collapsed[type] ? 'visibility_off' : 'visibility'"
              :label="type"
              :color="collapsed[type] ? 'grey-4' : 'blue-grey-6'"
              @click="toggleCollapsed(type)"
            />
          </template>
        </div>
        <q-scroll-area style="height: 395px" horizontal>
          <div class="row no-wrap q-gutter-x-md input-row q-px-xs">
            <template v-for="type in interfaceTypes" :key="`in-${type}`">
              <div v-show="!collapsed[type]" class="panel-col">
                <InputPanelV :section-title="type" />
              </div>
            </template>
          </div>
        </q-scroll-area>
      </div>

      <q-separator />

      <!-- OUTPUT 영역 -->
      <div>
        <div class="row items-center q-mb-sm q-gutter-sm">
          <q-item-label overline class="text-blue-8 area-label">OUTPUT</q-item-label>
          <q-separator vertical />
          <template v-for="type in interfaceTypes" :key="`toggle-out-${type}`">
            <q-btn
              v-if="COLLAPSIBLE_TYPES.has(type)"
              flat
              dense
              no-caps
              size="sm"
              :icon-right="collapsed[type] ? 'visibility_off' : 'visibility'"
              :label="type"
              :color="collapsed[type] ? 'grey-4' : 'blue-grey-6'"
              @click="toggleCollapsed(type)"
            />
          </template>
        </div>
        <q-scroll-area style="height: 420px" horizontal>
          <div class="row no-wrap q-gutter-x-md output-row q-px-xs">
            <template v-for="type in interfaceTypes" :key="`out-${type}`">
              <div v-show="!collapsed[type]" class="panel-col">
                <OutputPanelV :section-title="type" />
              </div>
            </template>
          </div>
        </q-scroll-area>
      </div>
    </div>
  </q-page>
</template>

<style scoped>
.area-label {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.1em;
}
.panel-col {
  flex-shrink: 0;
  align-self: flex-start;
}
.input-row,
.output-row {
  padding-bottom: 4px;
}
.input-scroll-area,
.output-scroll-area {
  width: 100%;
}
.input-scroll-area :deep(.q-scrollarea),
.output-scroll-area :deep(.q-scrollarea) {
  height: auto !important;
}
.input-scroll-area :deep(.q-scrollarea__container),
.output-scroll-area :deep(.q-scrollarea__container) {
  position: relative !important;
  height: auto !important;
  overflow-x: auto !important;
  overflow-y: visible !important;
}
.input-scroll-area :deep(.q-scrollarea__content),
.output-scroll-area :deep(.q-scrollarea__content) {
  height: auto !important;
  min-height: unset !important;
}
</style>
