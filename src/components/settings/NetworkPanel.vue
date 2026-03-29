<script setup>
import { ref, watch, onMounted } from 'vue'
import { useSettingsStore } from 'src/stores/settings'
import { useQuasar } from 'quasar'

const store = useSettingsStore()
const $q = useQuasar()
const mode  = ref('static') // 'dhcp' | 'static'
const form  = ref({ ip: '', subnet: '', gateway: '', dns: '' })
const errors = ref({ ip: '', subnet: '', gateway: '', dns: '' })

const fields = [
  { key: 'ip',      label: 'IP Address',  placeholder: '192.168.0.100', required: true  },
  { key: 'subnet',  label: 'Subnet Mask', placeholder: '255.255.255.0', required: true  },
  { key: 'gateway', label: 'Gateway',     placeholder: '192.168.0.1',   required: false },
  { key: 'dns',     label: 'DNS',         placeholder: '8.8.8.8',       required: false },
]

const readonlyFields = [
  { key: 'mac', label: 'MAC Address' },
]

const IP_RE = /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)){3}$/

function validateIp(val) {
  if (!val) return ''
  return IP_RE.test(val) ? '' : 'Invalid IP address'
}

function onBlur(key) {
  errors.value[key] = validateIp(form.value[key])
}

function validateAll() {
  if (mode.value === 'dhcp') return true
  let valid = true
  for (const f of fields) {
    const err = validateIp(form.value[f.key])
    errors.value[f.key] = err
    if (err || (f.required && !form.value[f.key])) valid = false
  }
  return valid
}

watch(() => store.network, (v) => {
  mode.value = v.mode ?? 'static'
  form.value = { ...v }
}, { immediate: true })
onMounted(() => store.fetchNetwork())

async function save() {
  if (!validateAll()) {
    $q.notify({ type: 'negative', message: 'Please correct the invalid fields.' })
    return
  }
  const payload = mode.value === 'dhcp'
    ? { mode: 'dhcp' }
    : { mode: 'static', ...form.value }
  const res = await store.saveNetwork(payload)
  if (res?.ok) {
    $q.notify({ type: 'positive', message: 'Network settings saved.' })
  } else {
    $q.notify({ type: 'negative', message: res?.error ?? 'Failed to save' })
  }
}

</script>

<template>
  <q-card flat bordered class="net-card">
    <q-card-section class="section-head">
      <q-icon name="lan" size="16px" class="q-mr-xs" />
      <span class="section-title">Network Settings</span>
    </q-card-section>
    <q-separator />

    <div v-if="store.networkLoading" class="row justify-center q-py-lg">
      <q-spinner size="24px" color="blue-7" />
    </div>

    <template v-else>
      <!-- MAC (read-only) -->
      <div v-for="f in readonlyFields" :key="f.key" class="net-row">
        <span class="net-label">{{ f.label }}</span>
        <span class="net-readonly">{{ store.network[f.key] || '—' }}</span>
      </div>

      <!-- Mode toggle -->
      <div class="net-row">
        <span class="net-label">Mode</span>
        <div class="mode-group">
          <button class="mode-btn" :class="{ 'mode-btn--on': mode === 'dhcp' }"
            @click="mode = 'dhcp'">DHCP</button>
          <button class="mode-btn" :class="{ 'mode-btn--on': mode === 'static' }"
            @click="mode = 'static'">Static</button>
        </div>
      </div>

      <!-- Static fields -->
      <template v-if="mode === 'static'">
        <div v-for="f in fields" :key="f.key" class="net-row">
          <span class="net-label">{{ f.label }}</span>
          <div class="net-input-wrap">
            <input
              v-model="form[f.key]"
              class="net-input"
              :class="{ 'net-input--error': errors[f.key] }"
              :placeholder="f.placeholder"
              @blur="onBlur(f.key)"
            />
            <span v-if="errors[f.key]" class="net-error">{{ errors[f.key] }}</span>
          </div>
        </div>
      </template>

      <q-separator />

      <div class="net-actions">
        <q-btn label="Save" color="blue-7" unelevated size="sm"
          :loading="store.networkSaving" @click="save" />
      </div>
    </template>
  </q-card>
</template>

<style scoped>
.net-card { border-radius: 8px; }

.section-head {
  display: flex;
  align-items: center;
  padding: 10px 16px;
}
.section-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: #455a64;
}

.net-row {
  display: flex;
  align-items: center;
  padding: 7px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.net-label {
  width: 110px;
  font-size: 12px;
  font-weight: 600;
  color: #546e7a;
  flex-shrink: 0;
}

.net-input-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  max-width: 200px;
}
.net-input {
  width: 100%;
  font-size: 13px;
  padding: 3px 6px;
  border: 1px solid #cfd8dc;
  border-radius: 3px;
  outline: none;
  color: #37474f;
  background: #fff;
}
.net-input:focus { border-color: #90caf9; background: #e3f2fd; }
.net-input--error { border-color: #ef5350; background: #fff8f8; }
.net-error { font-size: 10px; color: #ef5350; }
.mode-group { display: flex; gap: 4px; }
.mode-btn {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 12px;
  border: 1px solid #cfd8dc;
  border-radius: 3px;
  background: #f5f7fa;
  color: #546e7a;
  cursor: pointer;
  transition: all 0.15s;
}
.mode-btn:hover { border-color: #90caf9; color: #1565c0; }
.mode-btn--on { background: #1565c0; border-color: #1565c0; color: #fff; }

.net-readonly {
  font-size: 13px;
  font-family: 'Courier New', monospace;
  color: #78909c;
}

.net-actions {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
}
</style>
