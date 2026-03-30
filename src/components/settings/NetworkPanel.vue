<script setup>
import { onMounted } from 'vue'
import { useSettingsStore } from 'src/stores/settings.js'
import { useQuasar } from 'quasar'
import { storeToRefs } from 'pinia'
import { ruleExists, ruleIp } from 'src/composables/useRules.js'

const store = useSettingsStore()
const $q = useQuasar()
const { network } = storeToRefs(store)

onMounted(() => {
  $q.loading.show()
  store.fetchNetwork()
  $q.loading.hide()
  console.log('network settings loaded:', network.value)
})

async function save() {
  const payload =
    network.value.mode === 'dhcp' ? { mode: 'dhcp' } : { mode: 'static', ...network.value }
  const res = await store.saveNetwork(payload)
  if (res?.ok) {
    $q.notify({ type: 'positive', message: 'Network settings saved.' })
  } else {
    $q.notify({ type: 'negative', message: res?.error ?? 'Failed to save' })
  }
}
</script>

<template>
  <q-card flat bordered>
    <q-card-section class="row no-wrap justify-between q-pt-sm q-pb-xs">
      <div class="row no-wrap items-center">
        <q-icon name="lan" size="1.5rem" class="q-mr-xs" />
        <span class="item-title">Network Settings</span>
      </div>
      <span class="text-caption">{{ network.mac }}</span>
    </q-card-section>
    <q-separator />
    <q-item>
      <q-item-section>
        <q-item-label class="item-label">DHCP</q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-toggle
          :model-value="network.mode === 'dhcp'"
          color="blue-7"
          dense
          @update:model-value="network.mode = $event ? 'dhcp' : 'static'"
        />
      </q-item-section>
    </q-item>

    <!-- Static fields -->
    <q-form @submit.prevent="save">
      <q-item>
        <q-item-section>
          <q-item-label class="item-label">IP Address</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-input
            v-model="network.ip"
            :disable="network.mode === 'dhcp'"
            dense
            filled
            hide-bottom-space
            :rules="[ruleExists, ruleIp]"
            lazy-rules
          />
        </q-item-section>
      </q-item>
      <q-item>
        <q-item-section>
          <q-item-label class="item-label">Subnet Mask</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-input
            v-model="network.subnet"
            :disable="network.mode === 'dhcp'"
            dense
            filled
            hide-bottom-space
            :rules="[ruleExists, ruleIp]"
            lazy-rules
          />
        </q-item-section>
      </q-item>
      <q-item>
        <q-item-section>
          <q-item-label class="item-label">Gateway</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-input
            v-model="network.gateway"
            :disable="network.mode === 'dhcp'"
            dense
            filled
            hide-bottom-space
            :rules="[ruleExists, ruleIp]"
            lazy-rules
          />
        </q-item-section>
      </q-item>
      <q-item>
        <q-item-section>
          <q-item-label class="item-label">DNS</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-input
            v-model="network.dns"
            :disable="network.mode === 'dhcp'"
            dense
            filled
            hide-bottom-space
            :rules="[ruleExists, ruleIp]"
            lazy-rules
          />
        </q-item-section>
      </q-item>

      <q-card-actions align="right" class="q-pr-md">
        <q-btn round unelevated icon="check" color="primary" size="sm" type="submit">
          <q-tooltip>Apply</q-tooltip>
        </q-btn>
      </q-card-actions>
    </q-form>
  </q-card>
</template>

<style scoped></style>
