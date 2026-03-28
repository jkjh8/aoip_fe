<script setup>
import { ref } from 'vue'
import { socket } from 'src/boot/socket'

const props = defineProps({
  s:      { type: Object, required: true },
  detail: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['refresh'])

// ── Targets ───────────────────────────────────────────────
const newHost      = ref('')
const newPort      = ref('')
const targetBusy   = ref(false)
const targetNotify = ref(null)

function addTarget() {
  const host = newHost.value.trim()
  const port = Number(newPort.value)
  if (!host || !port) return
  targetBusy.value = true
  socket.emit('rtp:out:target:add', { client: props.s.client, host, port }, (res) => {
    targetBusy.value = false
    targetNotify.value = res?.ok ? 'ok' : 'err'
    if (res?.ok) { newHost.value = ''; newPort.value = ''; emit('refresh') }
    setTimeout(() => { targetNotify.value = null }, 2500)
  })
}

function removeTarget(host, port) {
  socket.emit('rtp:out:target:remove', { client: props.s.client, host, port }, (res) => {
    if (res?.ok) emit('refresh')
  })
}

// ── Codec ─────────────────────────────────────────────────
const codecOptions = [
  { label: 'MP3',       value: 'mp3' },
  { label: 'Opus',      value: 'opus' },
  { label: 'RAW (PCM)', value: 'raw' },
]
const bitrateOptions = {
  mp3:  [128, 160, 192, 224, 256, 320],
  opus: [64,  96,  128, 192, 256, 320],
}
const codecColor = { mp3: '#f57c00', opus: '#7b1fa2', raw: '#546e7a' }

const pendingCodec   = ref(null)
const pendingBitrate = ref(null)
const codecBusy      = ref(false)
const codecNotify    = ref(null)

const activeCodec   = () => pendingCodec.value   ?? props.detail?.codec   ?? 'mp3'
const activeBitrate = () => pendingBitrate.value  ?? props.detail?.bitrate ?? 320

function setCodec(c) {
  pendingCodec.value = c
  if (c === 'raw') pendingBitrate.value = null
}

function applyCodec() {
  const codec   = activeCodec()
  const bitrate = codec !== 'raw' ? activeBitrate() : undefined
  codecBusy.value = true
  codecNotify.value = null
  socket.emit('rtp:out:codec', { client: props.s.client, codec, bitrate }, (res) => {
    codecBusy.value = false
    codecNotify.value = res?.ok ? 'ok' : 'err'
    if (res?.ok) { pendingCodec.value = null; pendingBitrate.value = null; emit('refresh') }
    setTimeout(() => { codecNotify.value = null }, 2500)
  })
}
</script>

<template>
  <!-- UDP Targets -->
  <div class="st-section-label">UDP Targets</div>
  <div class="st-strip">
    <div class="target-list">
      <div
        v-for="t in (detail?.targets ?? [])"
        :key="`${t.host}:${t.port}`"
        class="target-chip"
      >
        <q-icon name="wifi_tethering" size="12px" color="blue-7" />
        <span class="target-addr">{{ t.host }}</span>
        <span class="target-colon">:</span>
        <span class="target-port">{{ t.port }}</span>
        <button class="target-remove" @click="removeTarget(t.host, t.port)">
          <q-icon name="close" size="11px" />
        </button>
      </div>
      <span v-if="!detail?.targets?.length" class="empty-hint">None</span>
    </div>
  </div>
  <div class="st-strip st-strip--form">
    <input
      v-model="newHost"
      class="st-input st-input--flex"
      placeholder="Host / IP"
      @keydown.enter="addTarget"
    />
    <input
      v-model="newPort"
      class="st-input st-input--port"
      placeholder="Port"
      type="number"
      @keydown.enter="addTarget"
    />
    <q-btn flat dense size="sm" icon="add" color="blue-7"
      :loading="targetBusy"
      :disable="!newHost || !newPort"
      @click="addTarget"
    >
      <q-tooltip class="bg-grey-4 text-grey-9" anchor="top middle" self="bottom middle" :offset="[0, 4]">Add</q-tooltip>
    </q-btn>
    <transition name="fade">
      <span v-if="targetNotify === 'ok'" class="notify notify--ok"><q-icon name="check_circle" size="13px" /> Added</span>
      <span v-else-if="targetNotify === 'err'" class="notify notify--err"><q-icon name="error" size="13px" /> Failed</span>
    </transition>
  </div>
  <q-separator />

  <!-- Codec -->
  <div class="st-section-label">
    Codec
    <span class="codec-badge" :style="`background:${codecColor[detail?.codec] ?? '#546e7a'}`">
      {{ detail?.codec?.toUpperCase() }}
      <template v-if="detail?.codec !== 'raw'">&thinsp;{{ detail?.bitrate }}k</template>
    </span>
  </div>
  <div class="st-strip st-strip--col">
    <div class="codec-row">
      <span class="codec-label">Format</span>
      <div class="seg-group">
        <button
          v-for="opt in codecOptions" :key="opt.value"
          class="seg-btn"
          :class="{ 'seg-btn--on': activeCodec() === opt.value }"
          @click="setCodec(opt.value)"
        >{{ opt.label }}</button>
      </div>
    </div>
    <transition name="fade">
      <div v-if="activeCodec() !== 'raw'" class="codec-row">
        <span class="codec-label">Bitrate</span>
        <div class="seg-group">
          <button
            v-for="br in (bitrateOptions[activeCodec()] ?? [])" :key="br"
            class="seg-btn"
            :class="{ 'seg-btn--on': activeBitrate() === br }"
            @click="pendingBitrate = br"
          >{{ br }}k</button>
        </div>
      </div>
    </transition>
    <div class="codec-row">
      <q-btn flat dense size="sm" icon="check" color="blue-7" label="Apply"
        :loading="codecBusy"
        :disable="!pendingCodec && !pendingBitrate"
        @click="applyCodec"
      />
      <transition name="fade">
        <span v-if="codecNotify === 'ok'" class="notify notify--ok"><q-icon name="check_circle" size="13px" /> Applied</span>
        <span v-else-if="codecNotify === 'err'" class="notify notify--err"><q-icon name="error" size="13px" /> Failed</span>
      </transition>
    </div>
  </div>
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

.target-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 28px;
}
.target-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  background: #e3f2fd;
  border: 1px solid #90caf9;
  border-radius: 3px;
  padding: 5px 10px;
  font-size: 13px;
}
.target-addr  { font-weight: 600; color: #1565c0; }
.target-colon { color: #90a4ae; }
.target-port  { font-weight: 700; color: #1565c0; font-family: 'Courier New', monospace; }
.target-remove {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 0 0 4px;
  color: #90a4ae;
  display: flex;
  align-items: center;
}
.target-remove:hover { color: #e53935; }
.empty-hint { font-size: 13px; color: #cfd8dc; }

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
.st-input--port { width: 120px; }

.codec-badge {
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  padding: 2px 7px;
  border-radius: 3px;
  letter-spacing: 0.3px;
}

.codec-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
}
.codec-label {
  font-size: 13px;
  font-weight: 600;
  color: #90a4ae;
  width: 54px;
  flex-shrink: 0;
}
.seg-group { display: flex; gap: 6px; flex-wrap: wrap; }
.seg-btn {
  background: #f5f5f5;
  border: 1px solid #cfd8dc;
  border-radius: 3px;
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #546e7a;
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s, color 0.1s;
}
.seg-btn:hover { background: #e3f2fd; border-color: #90caf9; }
.seg-btn--on   { background: #1565c0; border-color: #1565c0; color: #fff; }

.notify {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
}
.notify--ok  { color: #2e7d32; }
.notify--err { color: #c62828; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from,   .fade-leave-to     { opacity: 0; }
</style>
