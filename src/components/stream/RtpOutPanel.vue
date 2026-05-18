<script setup>
import { computed } from 'vue'

const props = defineProps({
  s: { type: Object, required: true },
  detail: { type: Object, default: () => ({}) },
  busy: { type: Boolean, default: false },
})

// ── Live stats ───────────────────────────────────────────
const liveKbps = computed(() => props.s?.stats?.bitrateKbps ?? 0)
const liveBytesSent = computed(() => props.s?.stats?.bytesSent ?? 0)

function fmtBytes(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' GB'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' MB'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + ' KB'
  return n + ' B'
}

// ── Format display ───────────────────────────────────────
const curCodec = computed(() => props.detail?.codec ?? '—')
const curBitrate = computed(() => props.detail?.bitrate ?? null)
const curProtocol = computed(() => props.detail?.protocol ?? '—')

const formatLabel = computed(() => {
  const parts = [curCodec.value.toUpperCase()]
  if (curCodec.value !== 'raw' && curBitrate.value) parts.push(`${curBitrate.value} kbps`)
  return parts.join(' · ')
})
</script>

<template>
  <!-- Live stats + Format compact -->
  <div class="st-section-label">Send Stream</div>
  <div class="st-strip cs-wrap">
    <span class="cs-item cs-w-bitrate">
      <span class="cs-key">Bitrate</span>
      <span class="cs-val" :class="liveKbps > 0 ? 'cs-active' : 'cs-muted'">
        {{ liveKbps > 0 ? liveKbps + ' kbps' : '—' }}
      </span>
    </span>
    <span class="cs-item cs-w-sent">
      <span class="cs-key">Sent</span>
      <span class="cs-val" :class="liveBytesSent > 0 ? 'cs-active' : 'cs-muted'">
        {{ liveBytesSent > 0 ? fmtBytes(liveBytesSent) : '—' }}
      </span>
    </span>
    <span class="cs-item cs-w-proto">
      <span class="cs-key">Protocol</span>
      <span class="cs-val">{{ curProtocol.toUpperCase() }}</span>
    </span>
    <span class="cs-item cs-w-codec">
      <span class="cs-key">Codec</span>
      <span class="cs-val">{{ formatLabel }}</span>
    </span>
  </div>
</template>

<style scoped>
.st-section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  color: #90a4ae;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  padding: 10px 18px 5px;
}
.lbl-btn {
  margin-left: 2px;
  opacity: 0.6;
}
.lbl-btn:hover {
  opacity: 1;
}
.add-btn {
  margin-left: auto;
}

.st-strip {
  padding: 8px 18px 12px;
}

/* ── Compact inline stats ── */
.cs-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 18px;
  align-items: center;
}
.cs-item {
  display: flex;
  gap: 4px;
  align-items: center;
  white-space: nowrap;
}
.cs-key {
  font-size: 11px;
  font-weight: 700;
  color: #90a4ae;
  letter-spacing: 0.4px;
}
.cs-val {
  font-size: 12px;
  font-weight: 500;
  color: #37474f;
  font-variant-numeric: tabular-nums;
  font-family: 'Courier New', monospace;
}
.cs-active {
  color: #1565c0;
  font-weight: 600;
}
.cs-muted {
  color: #b0bec5;
}

/* ── Fixed item widths ── */
.cs-w-bitrate {
  min-width: 96px;
}
.cs-w-sent {
  min-width: 80px;
}
.cs-w-proto {
  min-width: 68px;
}
.cs-w-codec {
  min-width: 100px;
}

/* ── Target list ── */
.target-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-height: 28px;
}
.target-card {
  display: flex;
  align-items: center;
  gap: 5px;
  background: #f5f9ff;
  border: 1px solid #90caf9;
  border-radius: 4px;
  padding: 7px 10px;
}
.target-addr {
  font-weight: 600;
  color: #1565c0;
  font-size: 13px;
}
.target-colon {
  color: #90a4ae;
  font-size: 13px;
}
.target-port {
  font-weight: 700;
  color: #1565c0;
  font-size: 13px;
  font-family: 'Courier New', monospace;
}
.target-remove {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 0 0 4px;
  color: #b0bec5;
  display: flex;
  align-items: center;
  margin-left: auto;
}
.target-remove:hover {
  color: #e53935;
}
.empty-hint {
  font-size: 13px;
  color: #cfd8dc;
}
</style>
