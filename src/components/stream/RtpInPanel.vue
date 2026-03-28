<script setup>
import { ref } from 'vue'
import { socket } from 'src/boot/socket'

const props = defineProps({
  s:      { type: Object, required: true },
  detail: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['refresh'])

// ── Port ─────────────────────────────────────────────────
const portInput  = ref('')
const portBusy   = ref(false)
const portNotify = ref(null)

function applyPort() {
  portBusy.value = true
  portNotify.value = null
  socket.emit('rtp:in:config', { client: props.s.client, port: Number(portInput.value) }, (res) => {
    portBusy.value = false
    portNotify.value = res?.ok ? 'ok' : 'err'
    if (res?.ok) { portInput.value = ''; emit('refresh') }
    setTimeout(() => { portNotify.value = null }, 2500)
  })
}

// ── Buffer ────────────────────────────────────────────────
const bufInput  = ref('')
const bufBusy   = ref(false)
const bufNotify = ref(null)

function applyBuffer() {
  bufBusy.value = true
  bufNotify.value = null
  socket.emit('rtp:in:config', { client: props.s.client, bufferMs: Number(bufInput.value) }, (res) => {
    bufBusy.value = false
    bufNotify.value = res?.ok ? 'ok' : 'err'
    if (res?.ok) { bufInput.value = ''; emit('refresh') }
    setTimeout(() => { bufNotify.value = null }, 2500)
  })
}

defineExpose({})
</script>

<template>
  <!-- Receive Stream stats -->
  <div class="st-section-label">Receive Stream</div>
  <div class="st-strip info-grid">
    <div class="info-row">
      <span class="info-key">Source</span>
      <span class="info-val">
        <template v-if="s.stats?.srcIp">
          <span class="ip-chip">{{ s.stats.srcIp }}</span>
          <span class="info-port-badge">:{{ s.stats.srcPort }}</span>
        </template>
        <span v-else class="info-muted">{{ s.ready ? 'Detecting…' : 'None' }}</span>
      </span>
    </div>
    <div class="info-row">
      <span class="info-key">Format</span>
      <span class="info-val" :class="s.stats?.codec && s.stats.codec !== 'unknown' ? '' : 'info-muted'">
        {{ s.stats?.codec && s.stats.codec !== 'unknown' ? s.stats.codec : '—' }}
      </span>
    </div>
    <div class="info-row">
      <span class="info-key">Bitrate</span>
      <span class="info-val" :class="s.stats?.bitrateKbps > 0 ? '' : 'info-muted'">
        {{ s.stats?.bitrateKbps > 0 ? s.stats.bitrateKbps + ' kbps' : '—' }}
      </span>
    </div>
    <div class="info-row">
      <span class="info-key">Buffer</span>
      <span class="info-val" :class="s.stats?.bufUsedMs > 0 ? '' : 'info-muted'">
        {{ s.stats?.bufUsedMs > 0 ? s.stats.bufUsedMs + ' ms' : '—' }}
      </span>
    </div>
    <div class="info-row">
      <span class="info-key">Packets</span>
      <span class="info-val">{{ (s.stats?.packets ?? 0).toLocaleString() }}</span>
    </div>
    <div class="info-row">
      <span class="info-key">Drops</span>
      <span class="info-val" :class="(s.stats?.drops ?? 0) > 0 ? 'info-warn' : ''">
        {{ (s.stats?.drops ?? 0).toLocaleString() }}
      </span>
    </div>
  </div>
  <q-separator />

  <!-- Config — hidden while running -->
  <template v-if="!s.running">
    <!-- UDP Receive Port -->
    <div class="st-section-label">
      UDP Receive Port
      <span class="val-current">Current: {{ detail?.port ?? '—' }}</span>
    </div>
    <div class="st-strip st-strip--form">
      <input
        v-model="portInput"
        class="st-input st-input--flex"
        placeholder="New port"
        type="number"
        @keydown.enter="applyPort"
      />
      <q-btn flat dense size="sm" icon="check" color="green-7"
        :loading="portBusy" :disable="!portInput"
        @click="applyPort"
      >
        <q-tooltip class="bg-grey-4 text-grey-9" anchor="top middle" self="bottom middle" :offset="[0, 4]">Apply Port</q-tooltip>
      </q-btn>
      <transition name="fade">
        <span v-if="portNotify === 'ok'" class="notify notify--ok"><q-icon name="check_circle" size="13px" /> Applied</span>
        <span v-else-if="portNotify === 'err'" class="notify notify--err"><q-icon name="error" size="13px" /> Failed</span>
      </transition>
    </div>
    <q-separator />

    <!-- Buffer -->
    <div class="st-section-label">
      Buffer
      <span class="val-current">Current: {{ detail?.bufferMs ?? 100 }} ms</span>
    </div>
    <div class="st-strip st-strip--form">
      <input
        v-model="bufInput"
        class="st-input st-input--flex"
        placeholder="Buffer size (ms)"
        type="number"
        min="10"
        max="500"
        @keydown.enter="applyBuffer"
      />
      <q-btn flat dense size="sm" icon="check" color="green-7"
        :loading="bufBusy" :disable="!bufInput"
        @click="applyBuffer"
      >
        <q-tooltip class="bg-grey-4 text-grey-9" anchor="top middle" self="bottom middle" :offset="[0, 4]">Apply Buffer</q-tooltip>
      </q-btn>
      <transition name="fade">
        <span v-if="bufNotify === 'ok'" class="notify notify--ok"><q-icon name="check_circle" size="13px" /> Applied</span>
        <span v-else-if="bufNotify === 'err'" class="notify notify--err"><q-icon name="error" size="13px" /> Failed</span>
      </transition>
    </div>
  </template>
</template>

<style scoped>
.st-section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  color: #90a4ae;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  padding: 10px 18px 5px;
}
.val-current {
  font-size: 13px;
  font-weight: 600;
  color: #455a64;
  text-transform: none;
  letter-spacing: 0;
}

.st-strip {
  padding: 8px 18px 12px;
  border-bottom: 1px solid #f0f2f5;
}
.st-strip:last-child { border-bottom: none; }
.st-strip--form {
  display: flex;
  align-items: center;
  gap: 8px;
}
.st-strip--col {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 10px;
  padding-bottom: 16px;
}

.st-input {
  border: 1px solid #cfd8dc;
  border-radius: 3px;
  padding: 7px 12px;
  font-size: 14px;
  color: #37474f;
  outline: none;
  background: #fafafa;
}
.st-input:focus { border-color: #1976d2; background: #fff; }
.st-input--flex { flex: 1; min-width: 0; }


.notify {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
}
.notify--ok  { color: #2e7d32; }
.notify--err { color: #c62828; }

.info-grid { display: flex; flex-direction: column; gap: 6px; }
.info-row  { display: flex; align-items: center; font-size: 13px; }
.info-key {
  font-size: 11px;
  font-weight: 700;
  color: #90a4ae;
  letter-spacing: 0.5px;
  width: 70px;
  flex-shrink: 0;
}
.info-val {
  color: #37474f;
  font-weight: 500;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
.info-muted { color: #b0bec5; }
.info-warn  { color: #e53935; font-weight: 700; }

.ip-chip {
  background: #e8f5e9;
  border: 1px solid #a5d6a7;
  border-radius: 3px;
  padding: 1px 7px;
  font-size: 12px;
  font-weight: 600;
  color: #2e7d32;
  font-family: 'Courier New', monospace;
}
.info-port-badge {
  font-size: 13px;
  font-weight: 700;
  color: #1565c0;
  font-family: 'Courier New', monospace;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from,   .fade-leave-to     { opacity: 0; }
</style>
