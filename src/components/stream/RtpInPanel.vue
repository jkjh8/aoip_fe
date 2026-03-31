<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  s: { type: Object, required: true },
  detail: { type: Object, default: () => ({}) },
})

// ── 편집 폼 (정지 상태에서만 사용) ───────────────────
const portInput = ref('')
const bufInput = ref('')
const addressInput = ref('')
const channelsInput = ref(null) // null = 현재값 유지
const protocolInput = ref(null) // null = 현재값 유지

const currentPort = computed(() => props.detail?.port ?? '—')
const currentBuf = computed(() => props.detail?.bufferMs ?? 100)
const currentAddress = computed(() => props.detail?.address ?? '0.0.0.0')
const currentChannels = computed(() => props.detail?.channels ?? 2)
const currentProtocol = computed(() => props.detail?.protocol ?? 'rtp')

/** StreamPanel의 Start 버튼이 REST POST body로 사용할 config */
function getPendingConfig() {
  const cfg = {}
  if (portInput.value) cfg.port = Number(portInput.value)
  if (bufInput.value) cfg.bufferMs = Number(bufInput.value)
  if (addressInput.value) cfg.address = addressInput.value.trim()
  if (channelsInput.value) cfg.channels = channelsInput.value
  if (protocolInput.value) cfg.protocol = protocolInput.value

  if (!cfg.port && props.detail?.port) cfg.port = props.detail.port
  if (!cfg.bufferMs && props.detail?.bufferMs) cfg.bufferMs = props.detail.bufferMs
  if (!cfg.address) cfg.address = currentAddress.value
  if (!cfg.channels) cfg.channels = currentChannels.value
  if (!cfg.protocol) cfg.protocol = currentProtocol.value

  return cfg
}

defineExpose({ getPendingConfig })
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
      <span
        class="info-val"
        :class="s.stats?.codec && s.stats.codec !== 'unknown' ? '' : 'info-muted'"
      >
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

  <!-- 수신 설정 표시 (항상)
  <div class="st-section-label">Config</div>
  <div class="st-strip info-grid">
    <div class="info-row">
      <span class="info-key">Protocol</span>
      <span class="info-val">
        <span class="cfg-tag">{{ (detail?.protocol ?? 'rtp').toUpperCase() }}</span>
      </span>
    </div>
    <div class="info-row">
      <span class="info-key">Address</span>
      <span class="info-val" :class="detail?.address && detail.address !== '0.0.0.0' ? '' : 'info-muted'">
        {{ detail?.address ?? '0.0.0.0' }}
      </span>
    </div>
    <div class="info-row">
      <span class="info-key">Port</span>
      <span class="info-val">{{ detail?.port ?? '—' }}</span>
    </div>
    <div class="info-row">
      <span class="info-key">Channels</span>
      <span class="info-val">{{ (detail?.channels ?? 2) === 1 ? 'Mono' : 'Stereo' }}</span>
    </div>
    <div class="info-row">
      <span class="info-key">Buffer</span>
      <span class="info-val">{{ detail?.bufferMs ?? 100 }} ms</span>
    </div>
  </div> -->
  <q-separator />

  <!-- Config 편집 — 정지 상태에서만 표시, Start 버튼 클릭 시 일괄 전송 -->
  <template v-if="!s.running">
    <div class="cfg-hint">Start 시 아래 설정이 적용됩니다</div>

    <!-- Protocol -->
    <div class="st-section-label">
      Protocol
      <span class="val-current">Current: {{ currentProtocol.toUpperCase() }}</span>
    </div>
    <div class="st-strip st-strip--form">
      <div class="seg-group">
        <button
          class="seg-btn"
          :class="{ 'seg-btn--on': (protocolInput ?? currentProtocol) === 'rtp' }"
          @click="protocolInput = 'rtp'"
        >
          RTP
        </button>
        <button
          class="seg-btn"
          :class="{ 'seg-btn--on': (protocolInput ?? currentProtocol) === 'raw' }"
          @click="protocolInput = 'raw'"
        >
          UDP Raw
        </button>
      </div>
    </div>

    <!-- Address -->
    <div class="st-section-label">
      Address
      <span class="val-current">Current: {{ currentAddress }}</span>
    </div>
    <div class="st-strip">
      <q-input
        v-model="addressInput"
        dense
        outlined
        placeholder="0.0.0.0 또는 멀티캐스트 239.x.x.x"
        class="cfg-input"
      />
    </div>

    <!-- Port -->
    <div class="st-section-label">
      UDP Receive Port
      <span class="val-current">Current: {{ currentPort }}</span>
    </div>
    <div class="st-strip">
      <q-input
        v-model="portInput"
        dense
        outlined
        placeholder="비우면 현재값 유지"
        type="number"
        class="cfg-input"
      />
    </div>

    <!-- Buffer -->
    <div class="st-section-label">
      Buffer
      <span class="val-current">Current: {{ currentBuf }} ms</span>
    </div>
    <div class="st-strip">
      <q-input
        v-model="bufInput"
        dense
        outlined
        placeholder="ms, 비우면 현재값 유지"
        type="number"
        class="cfg-input"
      />
    </div>

    <!-- Channels -->
    <div class="st-section-label">
      Channels
      <span class="val-current">Current: {{ currentChannels === 1 ? 'Mono' : 'Stereo' }}</span>
    </div>
    <div class="st-strip st-strip--form">
      <div class="seg-group">
        <button
          class="seg-btn"
          :class="{ 'seg-btn--on': (channelsInput ?? currentChannels) === 1 }"
          @click="channelsInput = 1"
        >
          Mono
        </button>
        <button
          class="seg-btn"
          :class="{ 'seg-btn--on': (channelsInput ?? currentChannels) === 2 }"
          @click="channelsInput = 2"
        >
          Stereo
        </button>
      </div>
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
.cfg-hint {
  font-size: 11px;
  color: #90a4ae;
  padding: 8px 18px 2px;
  font-style: italic;
}

.st-strip {
  padding: 8px 18px 12px;
  border-bottom: 1px solid #f0f2f5;
}
.st-strip:last-child {
  border-bottom: none;
}
.st-strip--form {
  display: flex;
  align-items: center;
  gap: 8px;
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
.st-input:focus {
  border-color: #1976d2;
  background: #fff;
}
.st-input--flex {
  flex: 1;
  min-width: 0;
}
.cfg-input {
  width: 100%;
}

.seg-group {
  display: flex;
  gap: 6px;
}
.seg-btn {
  background: #f5f5f5;
  border: 1px solid #cfd8dc;
  border-radius: 3px;
  padding: 6px 20px;
  font-size: 13px;
  font-weight: 600;
  color: #546e7a;
  cursor: pointer;
  transition:
    background 0.1s,
    border-color 0.1s,
    color 0.1s;
}
.seg-btn:hover {
  background: #e8f5e9;
  border-color: #a5d6a7;
}
.seg-btn--on {
  background: #2e7d32;
  border-color: #2e7d32;
  color: #fff;
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.info-row {
  display: flex;
  align-items: center;
  font-size: 13px;
}
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
.info-muted {
  color: #b0bec5;
}
.cfg-tag {
  font-size: 10px;
  font-weight: 700;
  background: #e3f2fd;
  color: #1565c0;
  padding: 1px 6px;
  border-radius: 3px;
  letter-spacing: 0.4px;
}
.info-warn {
  color: #e53935;
  font-weight: 700;
}

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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
