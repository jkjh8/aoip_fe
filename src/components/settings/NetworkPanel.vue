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
  else          $q.notify({ type: 'negative', message: res?.error ?? 'Failed to save' })
}
</script>

<template>
  <div class="st-panel">
    <!-- Header -->
    <div class="st-panel-head">
      <div class="head-left">
        <q-icon name="lan" size="16px" color="blue-7" />
        <span class="st-panel-title">Network Settings</span>
      </div>
      <span class="mac-badge" v-if="network.mac">{{ network.mac }}</span>
    </div>
    <q-separator />

    <!-- DHCP toggle -->
    <div class="st-section-label">Mode</div>
    <div class="st-strip st-strip--row">
      <span class="row-label">DHCP</span>
      <q-toggle
        :model-value="network.mode === 'dhcp'"
        color="blue-7"
        dense
        @update:model-value="network.mode = $event ? 'dhcp' : 'static'"
      />
    </div>
    <q-separator />

    <!-- Static fields -->
    <div class="st-section-label">IP Configuration</div>
    <q-form @submit.prevent="save">
      <div class="st-strip st-strip--row">
        <span class="row-label">IP Address</span>
        <q-input
          v-model="network.ip"
          :disable="network.mode === 'dhcp'"
          dense outlined
          hide-bottom-space
          :rules="[ruleExists, ruleIp]"
          lazy-rules
          class="row-input"
        />
      </div>
      <div class="st-strip st-strip--row">
        <span class="row-label">Subnet Mask</span>
        <q-input
          v-model="network.subnet"
          :disable="network.mode === 'dhcp'"
          dense outlined
          hide-bottom-space
          :rules="[ruleExists, ruleIp]"
          lazy-rules
          class="row-input"
        />
      </div>
      <div class="st-strip st-strip--row">
        <span class="row-label">Gateway</span>
        <q-input
          v-model="network.gateway"
          :disable="network.mode === 'dhcp'"
          dense outlined
          hide-bottom-space
          :rules="[ruleExists, ruleIp]"
          lazy-rules
          class="row-input"
        />
      </div>
      <div class="st-strip st-strip--row">
        <span class="row-label">DNS</span>
        <q-input
          v-model="network.dns"
          :disable="network.mode === 'dhcp'"
          dense outlined
          hide-bottom-space
          :rules="[ruleExists, ruleIp]"
          lazy-rules
          class="row-input"
        />
      </div>
      <div class="st-strip st-strip--row" style="justify-content:flex-end">
        <q-btn unelevated icon="check" color="blue-7" size="sm" label="Apply" type="submit" />
      </div>
    </q-form>
  </div>
</template>

<style scoped>
.st-panel {
  background: #fff;
  border: 1px solid #e4e6ea;
  border-radius: 4px;
}
.st-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
}
.head-left { display: flex; align-items: center; gap: 9px; }
.st-panel-title { font-size: 16px; font-weight: 600; color: #37474f; }
.mac-badge {
  font-size: 11px;
  font-weight: 600;
  color: #90a4ae;
  font-family: 'Courier New', monospace;
}

.st-section-label {
  font-size: 11px;
  font-weight: 700;
  color: #90a4ae;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  padding: 10px 18px 5px;
}
.st-strip {
  padding: 8px 18px 10px;
  border-bottom: 1px solid #f0f2f5;
}
.st-strip:last-child { border-bottom: none; }
.st-strip--row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.row-label {
  font-size: 13px;
  font-weight: 600;
  color: #546e7a;
  width: 110px;
  flex-shrink: 0;
}
.row-input { flex: 1; }
</style>
