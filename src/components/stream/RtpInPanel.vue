<script setup>
defineProps({
  s: { type: Object, required: true },
  detail: { type: Object, default: () => ({}) },
})

defineEmits(['refresh'])
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
