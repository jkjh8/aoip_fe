<script setup>
import { computed } from 'vue'

const props = defineProps({
  s:    { type: Object,  required: true },
  detail: { type: Object,  default: () => ({}) },
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['refresh', 'edit'])

const fillMs = computed(() => props.s.bufStats?.fillMs ?? props.s.stats?.bufStats?.fillMs ?? 0)
</script>

<template>
  <!-- Receive Stream stats -->
  <div class="st-section-label">
    Receive Stream
    <q-btn flat dense round size="xs" icon="edit" color="grey-5" :disable="busy" class="lbl-btn" @click="emit('edit')">
      <q-tooltip>수정{{ busy ? ' (처리중)' : '' }}</q-tooltip>
    </q-btn>
  </div>
  <div class="st-strip cs-wrap">
    <div class="cs-full">
      <span class="cs-key">Src</span>
      <span class="cs-val">
        <template v-if="s.stats?.srcIp">
          <span class="ip-chip">{{ s.stats.srcIp }}</span>
          <span class="info-port-badge">:{{ s.stats.srcPort }}</span>
        </template>
        <span v-else class="cs-muted">{{ s.ready ? 'Detecting…' : 'None' }}</span>
      </span>
    </div>
    <span class="cs-item cs-w-codec">
      <span class="cs-key">Codec</span>
      <span class="cs-val" :class="s.stats?.codec && s.stats.codec !== 'unknown' ? '' : 'cs-muted'">
        {{ s.stats?.codec && s.stats.codec !== 'unknown' ? s.stats.codec : '—' }}
      </span>
    </span>
    <span class="cs-item cs-w-bitrate">
      <span class="cs-key">Bitrate</span>
      <span class="cs-val" :class="s.stats?.bitrateKbps > 0 ? '' : 'cs-muted'">
        {{ s.stats?.bitrateKbps > 0 ? s.stats.bitrateKbps + ' kbps' : '—' }}
      </span>
    </span>
    <span class="cs-item cs-w-ms">
      <span class="cs-key">Buf</span>
      <span class="cs-val" :class="s.stats?.bufUsedMs > 0 ? '' : 'cs-muted'">
        {{ s.stats?.bufUsedMs > 0 ? s.stats.bufUsedMs + ' ms' : '—' }}
      </span>
    </span>
    <span class="cs-item cs-w-ms">
      <span class="cs-key">Fill</span>
      <span class="cs-val" :class="fillMs > 0 ? '' : 'cs-muted'">
        {{ fillMs > 0 ? fillMs + ' ms' : '—' }}
      </span>
    </span>
    <span class="cs-item cs-w-pkts">
      <span class="cs-key">Pkts</span>
      <span class="cs-val">{{ (s.stats?.packets ?? 0).toLocaleString() }}</span>
    </span>
    <span class="cs-item cs-w-drops">
      <span class="cs-key">Drops</span>
      <span class="cs-val" :class="(s.stats?.drops ?? 0) > 0 ? 'cs-warn' : ''">
        {{ (s.stats?.drops ?? 0).toLocaleString() }}
      </span>
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
.lbl-btn { margin-left: 2px; opacity: 0.6; }
.lbl-btn:hover { opacity: 1; }

.st-strip {
  padding: 8px 18px 12px;
  border-bottom: 1px solid #f0f2f5;
}
.st-strip:last-child {
  border-bottom: none;
}

/* ── Compact inline stats ── */
.cs-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 18px;
  align-items: center;
}
.cs-full {
  flex: 0 0 100%;
  display: flex;
  gap: 6px;
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
  display: flex;
  align-items: center;
  gap: 3px;
  font-variant-numeric: tabular-nums;
  font-family: 'Courier New', monospace;
}
.cs-muted { color: #b0bec5; }
.cs-warn  { color: #e53935; font-weight: 700; }

/* ── Fixed item widths (prevents layout shift on value change) ── */
.cs-w-codec   { min-width: 72px; }
.cs-w-bitrate { min-width: 96px; }
.cs-w-ms      { min-width: 66px; }
.cs-w-pkts    { min-width: 80px; }
.cs-w-drops   { min-width: 58px; }

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

/* ── Form section (unchanged) ── */
.st-strip--form {
  display: flex;
  align-items: center;
  gap: 8px;
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
.cfg-input { width: 100%; }

.seg-group { display: flex; gap: 6px; }
.seg-btn {
  background: #f5f5f5;
  border: 1px solid #cfd8dc;
  border-radius: 3px;
  padding: 6px 20px;
  font-size: 13px;
  font-weight: 600;
  color: #546e7a;
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s, color 0.1s;
}
.seg-btn:hover { background: #e8f5e9; border-color: #a5d6a7; }
.seg-btn--on { background: #2e7d32; border-color: #2e7d32; color: #fff; }

/* keep info-row / info-key for any inherited usage */
.info-grid { display: flex; flex-direction: column; gap: 6px; }
.info-row  { display: flex; align-items: center; font-size: 13px; }
.info-key  { font-size: 11px; font-weight: 700; color: #90a4ae; letter-spacing: 0.5px; width: 70px; flex-shrink: 0; }
.info-val  { color: #37474f; font-weight: 500; display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
.cfg-tag   { font-size: 10px; font-weight: 700; background: #e3f2fd; color: #1565c0; padding: 1px 6px; border-radius: 3px; letter-spacing: 0.4px; }
</style>
