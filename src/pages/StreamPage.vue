<script setup>
import { ref, computed } from 'vue'
import { socket, aoipState } from 'src/boot/socket'

// ── 상태 헬퍼 ─────────────────────────────────────────────
const tx = computed(() => aoipState.streams?.tx ?? { running: false, targets: [], codec: 'mp3', bitrate: 320 })
const rx = computed(() => aoipState.streams?.rx ?? { running: false, port: 10001, codec: 'mp3' })

// ── TX 타겟 ───────────────────────────────────────────────
const newHost = ref('')
const newPort = ref('')
const targetBusy = ref(false)

function addTarget() {
  const host = newHost.value.trim()
  const port = Number(newPort.value)
  if (!host || !port) return
  targetBusy.value = true
  socket.emit('tx:target:add', { host, port }, (res) => {
    targetBusy.value = false
    if (res?.ok) { newHost.value = ''; newPort.value = '' }
  })
}

function removeTarget(t) {
  socket.emit('tx:target:remove', { host: t.host, port: t.port })
}

// ── TX 파이프라인 Start / Stop ─────────────────────────────
const txActionBusy = ref(false)

function toggleTx() {
  txActionBusy.value = true
  const ev = tx.value.running ? 'tx:stop' : 'tx:start'
  socket.emit(ev, () => { txActionBusy.value = false })
}

// ── TX 코덱 ───────────────────────────────────────────────
const codecOptions = [
  { label: 'MP3',      value: 'mp3' },
  { label: 'Opus',     value: 'opus' },
  { label: 'RAW (PCM)', value: 'raw' },
]
const bitrateOptions = {
  mp3:  [128, 160, 192, 224, 256, 320],
  opus: [64,  96,  128, 192, 256, 320],
}

// 편집 중인 값 (서버와 별도 관리 — Apply 전까지 반영 안 됨)
const pendingCodec   = ref(null)
const pendingBitrate = ref(null)

const activeCodec   = computed(() => pendingCodec.value   ?? tx.value.codec   ?? 'mp3')
const activeBitrate = computed(() => pendingBitrate.value ?? tx.value.bitrate ?? 320)
const showBitrate   = computed(() => activeCodec.value !== 'raw')

function setCodec(c) {
  pendingCodec.value = c
  // raw 로 바꾸면 bitrate pending 해제
  if (c === 'raw') pendingBitrate.value = null
}

const codecBusy = ref(false)
const codecNotify = ref(null) // 'ok' | 'err'

function applyCodec() {
  codecBusy.value = true
  codecNotify.value = null
  const payload = { codec: activeCodec.value }
  if (showBitrate.value) payload.bitrate = activeBitrate.value
  socket.emit('tx:codec', payload, (res) => {
    codecBusy.value = false
    codecNotify.value = res?.ok ? 'ok' : 'err'
    if (res?.ok) { pendingCodec.value = null; pendingBitrate.value = null }
    setTimeout(() => (codecNotify.value = null), 2500)
  })
}

// ── RX 버퍼 ───────────────────────────────────────────────
const rxBufInput  = ref('')
const rxBufBusy   = ref(false)
const rxBufNotify = ref(null)

function applyRxBuffer() {
  const ms = Number(rxBufInput.value)
  if (!ms || ms < 10 || ms > 200) return
  rxBufBusy.value = true
  rxBufNotify.value = null
  socket.emit('rx:buffer', { bufferMs: ms }, (res) => {
    rxBufBusy.value = false
    rxBufNotify.value = res?.ok ? 'ok' : 'err'
    if (res?.ok) rxBufInput.value = ''
    setTimeout(() => (rxBufNotify.value = null), 2500)
  })
}

// ── RX 포트 ───────────────────────────────────────────────
const rxPortInput = ref('')
const rxPortBusy  = ref(false)
const rxPortNotify = ref(null)

function applyRxPort() {
  const port = Number(rxPortInput.value)
  if (!port) return
  rxPortBusy.value = true
  rxPortNotify.value = null
  socket.emit('rx:port', { port }, (res) => {
    rxPortBusy.value = false
    rxPortNotify.value = res?.ok ? 'ok' : 'err'
    if (res?.ok) rxPortInput.value = ''
    setTimeout(() => (rxPortNotify.value = null), 2500)
  })
}

// ── RX 파이프라인 Start / Stop ────────────────────────────
const rxActionBusy = ref(false)

function toggleRx() {
  rxActionBusy.value = true
  const ev = rx.value.running ? 'rx:stop' : 'rx:start'
  socket.emit(ev, () => { rxActionBusy.value = false })
}

// ── 공통 ──────────────────────────────────────────────────
const codecColor = { mp3: '#f57c00', opus: '#7b1fa2', raw: '#546e7a', wav: '#00796b' }
</script>

<template>
  <q-page class="stream-page">
    <!-- 연결 끊김 -->
    <div v-if="!aoipState.connected" class="row justify-center q-mt-xl">
      <q-chip color="negative" text-color="white" icon="wifi_off">lost connection</q-chip>
    </div>

    <template v-else>
      <div class="panels-row">

        <!-- ══════════ RX ══════════ -->
        <div class="st-panel">
          <div class="st-panel-head">
            <div class="st-panel-head-left">
              <q-icon name="download" size="16px" color="green-7" />
              <span class="st-panel-title">RX Receive</span>
              <span class="run-dot" :class="rx.running ? 'run-dot--on' : 'run-dot--off'" />
              <span class="run-label" :class="rx.running ? 'run-label--on' : 'run-label--off'">
                {{ rx.running ? 'RUNNING' : 'STOPPED' }}
              </span>
            </div>
            <q-btn
              flat round size="md"
              :icon="rx.running ? 'stop_circle' : 'play_circle'"
              :color="rx.running ? 'negative' : 'positive'"
              :loading="rxActionBusy"
              @click="toggleRx"
            />
          </div>
          <q-separator />

          <!-- 수신 스트림 정보 -->
          <div class="st-section-label">수신 스트림</div>
          <div class="st-strip info-grid">
            <div class="info-row">
              <span class="info-key">Source</span>
              <span class="info-val">
                <template v-if="aoipState.rxStats.srcIp">
                  <span class="ip-chip">{{ aoipState.rxStats.srcIp }}</span>
                  <span class="info-port-badge">:{{ aoipState.rxStats.srcPort }}</span>
                </template>
                <span v-else class="info-muted">{{ rx.running ? '감지 중…' : '없음' }}</span>
              </span>
            </div>
            <div class="info-row">
              <span class="info-key">Format</span>
              <span class="info-val" :class="aoipState.rxStats.codec ? '' : 'info-muted'">
                {{ aoipState.rxStats.codec || '—' }}
              </span>
            </div>
            <div class="info-row">
              <span class="info-key">Bitrate</span>
              <span class="info-val" :class="aoipState.rxStats.bitrateKbps > 0 ? '' : 'info-muted'">
                {{ aoipState.rxStats.bitrateKbps > 0 ? aoipState.rxStats.bitrateKbps + ' kbps' : '—' }}
              </span>
            </div>
            <div class="info-row">
              <span class="info-key">Buffer</span>
              <span class="info-val" :class="aoipState.rxStats.bufUsedMs > 0 ? '' : 'info-muted'">
                {{ aoipState.rxStats.bufUsedMs > 0 ? aoipState.rxStats.bufUsedMs + ' ms' : '—' }}
              </span>
            </div>
            <div class="info-row">
              <span class="info-key">Packets</span>
              <span class="info-val">{{ (aoipState.rxStats.packets ?? 0).toLocaleString() }}</span>
            </div>
            <div class="info-row">
              <span class="info-key">Drops</span>
              <span class="info-val" :class="(aoipState.rxStats.drops ?? 0) > 0 ? 'info-warn' : ''">
                {{ (aoipState.rxStats.drops ?? 0).toLocaleString() }}
              </span>
            </div>
          </div>
          <q-separator />

          <!-- UDP 수신 포트 / Buffer — 수신 중지 상태에서만 표시 -->
          <template v-if="!rx.running">
            <q-separator />
            <div class="st-section-label">
              UDP Receive Port
              <span class="port-current">현재 {{ rx.port }}</span>
            </div>
            <div class="st-strip st-strip--form">
              <input v-model="rxPortInput" class="st-input st-input--flex" placeholder="새 포트" type="number" @keydown.enter="applyRxPort" />
              <q-btn flat dense size="sm" icon="check" color="green-7" :loading="rxPortBusy" :disable="!rxPortInput" @click="applyRxPort">
                <q-tooltip class="bg-grey-4 text-grey-9" anchor="top middle" self="bottom middle" :offset="[0,4]">포트 변경</q-tooltip>
              </q-btn>
              <transition name="fade">
                <span v-if="rxPortNotify === 'ok'" class="notify notify--ok"><q-icon name="check_circle" size="13px" /> 적용됨</span>
                <span v-else-if="rxPortNotify === 'err'" class="notify notify--err"><q-icon name="error" size="13px" /> 실패</span>
              </transition>
            </div>
            <q-separator />
            <div class="st-section-label">
              Buffer
              <span class="port-current">현재 {{ rx.bufferMs ?? 100 }} ms</span>
            </div>
            <div class="st-strip st-strip--form">
              <input v-model="rxBufInput" class="st-input st-input--flex" placeholder="버퍼 크기 (ms, 10~200)" type="number" min="10" max="200" @keydown.enter="applyRxBuffer" />
              <q-btn flat dense size="sm" icon="check" color="green-7" :loading="rxBufBusy" :disable="!rxBufInput" @click="applyRxBuffer">
                <q-tooltip class="bg-grey-4 text-grey-9" anchor="top middle" self="bottom middle" :offset="[0,4]">버퍼 변경</q-tooltip>
              </q-btn>
              <transition name="fade">
                <span v-if="rxBufNotify === 'ok'" class="notify notify--ok"><q-icon name="check_circle" size="13px" /> 적용됨</span>
                <span v-else-if="rxBufNotify === 'err'" class="notify notify--err"><q-icon name="error" size="13px" /> 실패</span>
              </transition>
            </div>
          </template>

        </div>

        <!-- ══════════ TX ══════════ -->
        <div class="st-panel">
          <div class="st-panel-head">
            <div class="st-panel-head-left">
              <q-icon name="upload" size="16px" color="blue-7" />
              <span class="st-panel-title">TX Transmit</span>
              <span class="run-dot" :class="tx.running ? 'run-dot--on' : 'run-dot--off'" />
              <span class="run-label" :class="tx.running ? 'run-label--on' : 'run-label--off'">
                {{ tx.running ? 'RUNNING' : 'STOPPED' }}
              </span>
            </div>
            <q-btn
              flat round size="md"
              :icon="tx.running ? 'stop_circle' : 'play_circle'"
              :color="tx.running ? 'negative' : 'positive'"
              :loading="txActionBusy"
              @click="toggleTx"
            />
          </div>
          <q-separator />

          <!-- UDP Targets -->
          <div class="st-section-label">UDP Targets</div>
          <div class="st-strip">
            <div class="target-list">
              <div
                v-for="t in tx.targets"
                :key="`${t.host}:${t.port}`"
                class="target-chip"
              >
                <q-icon name="wifi_tethering" size="12px" color="blue-7" />
                <span class="target-addr">{{ t.host }}</span>
                <span class="target-colon">:</span>
                <span class="target-port">{{ t.port }}</span>
                <button class="target-remove" @click="removeTarget(t)">
                  <q-icon name="close" size="11px" />
                </button>
              </div>
              <span v-if="!tx.targets?.length" class="empty-hint">없음</span>
            </div>
          </div>

          <!-- 타겟 추가 -->
          <div class="st-strip st-strip--form">
            <input v-model="newHost" class="st-input st-input--flex" placeholder="Host / IP" @keydown.enter="addTarget" />
            <input v-model="newPort" class="st-input st-input--port" placeholder="Port" type="number" @keydown.enter="addTarget" />
            <q-btn flat dense size="sm" icon="add" color="blue-7" :loading="targetBusy" :disable="!newHost || !newPort" @click="addTarget">
              <q-tooltip class="bg-grey-4 text-grey-9" anchor="top middle" self="bottom middle" :offset="[0,4]">추가</q-tooltip>
            </q-btn>
          </div>
          <q-separator />

          <!-- TX Codec -->
          <div class="st-section-label">
            Codec
            <span class="codec-badge" :style="`background:${codecColor[tx.codec] ?? '#546e7a'}`">
              {{ tx.codec?.toUpperCase() }}<template v-if="tx.codec !== 'raw'">&thinsp;{{ tx.bitrate }}k</template>
            </span>
          </div>
          <div class="st-strip st-strip--col">
            <div class="codec-row">
              <span class="codec-label">Format</span>
              <div class="seg-group">
                <button v-for="opt in codecOptions" :key="opt.value"
                  class="seg-btn" :class="{ 'seg-btn--on': activeCodec === opt.value }"
                  @click="setCodec(opt.value)">{{ opt.label }}</button>
              </div>
            </div>
            <transition name="fade">
              <div v-if="showBitrate" class="codec-row">
                <span class="codec-label">Bitrate</span>
                <div class="seg-group">
                  <button v-for="br in bitrateOptions[activeCodec] ?? []" :key="br"
                    class="seg-btn" :class="{ 'seg-btn--on': activeBitrate === br }"
                    @click="pendingBitrate = br">{{ br }}k</button>
                </div>
              </div>
            </transition>
            <div class="codec-row">
              <q-btn flat dense size="sm" icon="check" color="blue-7" label="Apply"
                :loading="codecBusy" :disable="!pendingCodec && !pendingBitrate" @click="applyCodec" />
              <transition name="fade">
                <span v-if="codecNotify === 'ok'" class="notify notify--ok"><q-icon name="check_circle" size="13px" /> 적용됨</span>
                <span v-else-if="codecNotify === 'err'" class="notify notify--err"><q-icon name="error" size="13px" /> 실패</span>
              </transition>
            </div>
          </div>

        </div>

      </div>
    </template>
  </q-page>
</template>

<style scoped>
.stream-page { background: #f4f6f8; min-height: 100vh; }


.panels-row {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 24px;
  max-width: 720px;
  margin: 0 auto;
}

/* ── 패널 ── */
.st-panel {
  background: #fff;
  border: 1px solid #e4e6ea;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
}

/* ── 패널 헤더 ── */
.st-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
}
.st-panel-head-left {
  display: flex;
  align-items: center;
  gap: 9px;
}
.st-panel-title {
  font-size: 16px;
  font-weight: 600;
  color: #37474f;
}

.run-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.run-dot--on  { background: #43a047; box-shadow: 0 0 0 2px #c8e6c9; }
.run-dot--off { background: #bdbdbd; }

.run-label {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.5px;
}
.run-label--on  { color: #2e7d32; }
.run-label--off { color: #9e9e9e; }

/* ── 섹션 라벨 ── */
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

/* ── 스트립 (행) ── */
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

/* ── 타겟 목록 ── */
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
.target-addr { font-weight: 600; color: #1565c0; }
.target-colon { color: #90a4ae; }
.target-port { font-weight: 700; color: #1565c0; font-family: 'Courier New', monospace; }
.target-remove {
  background: none; border: none; cursor: pointer;
  padding: 0 0 0 4px; color: #90a4ae; display: flex; align-items: center;
}
.target-remove:hover { color: #e53935; }
.empty-hint { font-size: 13px; color: #cfd8dc; }

/* ── 입력창 ── */
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

/* ── 코덱 배지 ── */
.codec-badge {
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  padding: 2px 7px;
  border-radius: 3px;
  letter-spacing: 0.3px;
}
.port-current {
  font-size: 13px;
  font-weight: 600;
  color: #455a64;
  text-transform: none;
  letter-spacing: 0;
}

/* ── 코덱 선택 ── */
.codec-row {
  display: flex;
  align-items: center;
  gap: 12px;
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
.seg-btn:hover    { background: #e3f2fd; border-color: #90caf9; }
.seg-btn--on      { background: #1565c0; border-color: #1565c0; color: #fff; }

/* ── 알림 ── */
.notify {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 13px; font-weight: 600;
}
.notify--ok  { color: #2e7d32; }
.notify--err { color: #c62828; }

/* ── 수신 정보 그리드 ── */
.info-grid { display: flex; flex-direction: column; gap: 8px; }

.info-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}
.info-key {
  font-size: 11px;
  font-weight: 700;
  color: #90a4ae;
  letter-spacing: 0.5px;
  width: 62px;
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
.info-warn { color: #e53935; font-weight: 700; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from,   .fade-leave-to     { opacity: 0; }
</style>
