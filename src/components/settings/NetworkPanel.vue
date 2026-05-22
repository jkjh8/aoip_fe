<script setup>
import { onMounted } from 'vue'
import { useSettingsStore } from 'src/stores/settings.js'
import { useQuasar } from 'quasar'
import { storeToRefs } from 'pinia'
import { ruleExists, ruleIp } from 'src/composables/useRules.js'

const store = useSettingsStore()
const $q = useQuasar()
const { network } = storeToRefs(store)

onMounted(() => store.fetchNetwork())

async function save() {
  const payload =
    network.value.mode === 'dhcp' ? { mode: 'dhcp' } : { mode: 'static', ...network.value }
  const res = await store.saveNetwork(payload)
  if (res?.ok) $q.notify({ type: 'positive', message: 'Network settings saved.' })
  else $q.notify({ type: 'negative', message: res?.error ?? 'Failed to save' })
}
</script>

<template>
  <q-card flat bordered>
    <q-card-section class="row no-wrap justify-between items-center q-px-lg q-py-md">
      <div class="row q-gutter-x-xs row justify-start items-center">
        <q-icon name="lan" size="20px" color="blue-7" />
        <span class="st-panel-title">Network Settings</span>
      </div>
      <span class="mac-badge" v-if="network.mac">{{ network.mac }}</span>
    </q-card-section>
    <q-separator />

    <q-card-section class="q-py-none">
      <div class="row no-wrap justify-between items-center q-px-md q-py-none q-my-none">
        <span class="row-label">DHCP</span>
        <q-toggle
          :model-value="network.mode === 'dhcp'"
          color="blue-7"
          size="lg"
          @update:model-value="network.mode = $event ? 'dhcp' : 'static'"
        />
      </div>
    </q-card-section>
    <q-separator />
    <q-card-section>
      <q-form @submit.prevent="save" class="q-gutter-y-sm">
        <div class="row no-wrap justify-between items-center q-px-md q-gutter-x-md">
          <span class="row-label">IP Address</span>
          <q-input
            v-model="network.ip"
            :disable="network.mode === 'dhcp'"
            dense
            outlined
            hide-bottom-space
            :rules="[ruleExists, ruleIp]"
            lazy-rules
          />
        </div>
        <div class="row no-wrap justify-between items-center q-px-md q-gutter-x-md">
          <span class="row-label">Subnet Mask</span>
          <q-input
            v-model="network.subnet"
            :disable="network.mode === 'dhcp'"
            dense
            outlined
            hide-bottom-space
            :rules="[ruleExists, ruleIp]"
            lazy-rules
          />
        </div>
        <div class="row no-wrap justify-between items-center q-px-md q-gutter-x-md">
          <span class="row-label">Gateway</span>
          <q-input
            v-model="network.gateway"
            :disable="network.mode === 'dhcp'"
            dense
            outlined
            hide-bottom-space
            :rules="[ruleExists, ruleIp]"
            lazy-rules
          />
        </div>
        <div class="row no-wrap justify-between items-center q-px-md q-gutter-x-md">
          <span class="row-label">DNS</span>
          <q-input
            v-model="network.dns"
            :disable="network.mode === 'dhcp'"
            dense
            outlined
            hide-bottom-space
            :rules="[ruleExists, ruleIp]"
            lazy-rules
          />
        </div>
      </q-form>
    </q-card-section>
    <q-card-actions align="right" class="q-px-md">
      <q-btn
        class="q-mr-md"
        style="width: 90px"
        unelevated
        color="blue-7"
        size="md"
        type="submit"
        label="SAVE"
      >
      </q-btn>
    </q-card-actions>
  </q-card>
</template>

<style scoped>
:deep(.row-input .q-field__control) {
  min-height: 28px !important;
  height: 28px;
}
:deep(.row-input .q-field__native) {
  padding: 0;
  min-height: 28px;
}
</style>
