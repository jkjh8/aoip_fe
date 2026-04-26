<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { api } from 'src/boot/axios'
import { useAoipStore } from 'src/stores/aoip'
import Aes67SourcePanel from 'src/components/aes67/Aes67SourcePanel.vue'
import Aes67SinkPanel   from 'src/components/aes67/Aes67SinkPanel.vue'

const aoipState = useAoipStore()

// ── Data ─────────────────────────────────────────────────
const sources   = ref([])
const sinks     = ref([])
const ptpStatus = ref(null)

async function fetchAll() {
  try {
    const ts = Date.now()
    const [sRes, kRes, ptpRes] = await Promise.all([
      api.get('/aes67/sources',    { params: { _: ts } }),
      api.get('/aes67/sinks',      { params: { _: ts } }),
      api.get('/aes67/ptp/status', { params: { _: ts } }),
    ])
    sources.value   = sRes.data?.sources ?? []
    sinks.value     = kRes.data?.sinks   ?? []
    ptpStatus.value = ptpRes.data
  } catch { /* daemon may be offline */ }
}

onMounted(fetchAll)
const timer = setInterval(fetchAll, 10000)
onUnmounted(() => clearInterval(timer))

const aes67 = computed(() => aoipState.aes67 ?? { running: false, ready: false })

// ── Daemon control ────────────────────────────────────────
const daemonBusy = ref(false)

async function toggleDaemon() {
  daemonBusy.value = true
  try {
    if (aes67.value.running) await api.post('/aes67/stop')
    else                     await api.post('/aes67/start')
    await new Promise(r => setTimeout(r, 1500))
    await fetchAll()
  } finally { daemonBusy.value = false }
}

// ── PTP display ───────────────────────────────────────────
const ptpLocked = computed(() => ptpStatus.value?.status === 'locked')
const ptpLabel  = computed(() => {
  if (!ptpStatus.value) return '—'
  const { status, gmid, jitter } = ptpStatus.value
  if (status === 'locked') return `Locked · GM ${gmid} · ${jitter}ns`
  return status ?? 'Unknown'
})

// ── Next ID helpers ───────────────────────────────────────
const nextSourceId = computed(() =>
  sources.value.length ? Math.max(...sources.value.map(s => s.id)) + 1 : 0)
const nextSinkId = computed(() =>
  sinks.value.length ? Math.max(...sinks.value.map(s => s.id)) + 1 : 0)

// ─────────────────────────────────────────────────────────
// Add Source dialog
// ─────────────────────────────────────────────────────────
const showAddSource = ref(false)
const srcBusy       = ref(false)
const srcError      = ref('')

const srcForm = ref({
  name:    '',
  address: '239.69.0.1',
  codec:   'L24',
  spp:     48,
  channels: 2,
  chStart:  0,
  ttl:     15,
})

const srcCodecOptions = ['L16', 'L24', 'AM824']
const srcSppOptions   = [12, 24, 48, 96, 192]

function openAddSource() {
  srcForm.value = { name: '', address: '239.69.0.1', codec: 'L24', spp: 48, channels: 2, chStart: 0, ttl: 15 }
  srcError.value = ''
  showAddSource.value = true
}

async function confirmAddSource() {
  const f = srcForm.value
  if (!f.name.trim()) { srcError.value = '이름을 입력하세요'; return }
  if (!f.address.trim()) { srcError.value = '주소를 입력하세요'; return }

  srcBusy.value  = true
  srcError.value = ''
  const map = Array.from({ length: f.channels }, (_, i) => f.chStart + i)
  try {
    await api.put(`/aes67/sources/${nextSourceId.value}`, {
      enabled:               true,
      name:                  f.name.trim(),
      io:                    'Audio Device',
      address:               f.address.trim(),
      codec:                 f.codec,
      max_samples_per_packet: f.spp,
      ttl:                   f.ttl,
      payload_type:          98,
      dscp:                  34,
      refclk_ptp_traceable:  false,
      map,
    })
    showAddSource.value = false
    await fetchAll()
  } catch (e) { srcError.value = e.response?.data?.error ?? 'Failed' }
  srcBusy.value = false
}

// ─────────────────────────────────────────────────────────
// Add Sink dialog
// ─────────────────────────────────────────────────────────
const showAddSink  = ref(false)
const sinkBusy     = ref(false)
const sinkError    = ref('')
const sinkTab      = ref('browse')    // 'browse' | 'manual'
const browseList   = ref([])
const browseBusy   = ref(false)
const selectedRemote = ref(null)

const sinkForm = ref({
  name:             '',
  url:              '',
  rawSdp:           '',
  delay:            192,
  ignoreRefclk:     true,
  channels:         2,
  chStart:          0,
})

async function openAddSink() {
  sinkForm.value  = { name: '', url: '', rawSdp: '', delay: 192, ignoreRefclk: true, channels: 2, chStart: 0 }
  sinkError.value = ''
  selectedRemote.value = null
  sinkTab.value   = 'browse'
  showAddSink.value = true
  await doBrowse()
}

async function doBrowse() {
  browseBusy.value = true
  try {
    const res = await api.get('/aes67/browse')
    browseList.value = res.data?.remote_sources ?? []
  } catch { browseList.value = [] }
  browseBusy.value = false
}

function selectRemote(src) {
  selectedRemote.value = src
  if (!sinkForm.value.name) sinkForm.value.name = src.name

  // SDP에서 채널 수 자동 감지
  const m = (src.sdp ?? '').match(/a=rtpmap:\d+\s+\S+\/\d+\/(\d+)/)
  if (m) sinkForm.value.channels = Number(m[1])
}

async function confirmAddSink() {
  const f = sinkForm.value
  if (!f.name.trim()) { sinkError.value = '이름을 입력하세요'; return }

  if (sinkTab.value === 'browse' && !selectedRemote.value) {
    sinkError.value = '소스를 선택하세요'; return
  }
  if (sinkTab.value === 'manual' && !f.url.trim() && !f.rawSdp.trim()) {
    sinkError.value = 'URL 또는 SDP를 입력하세요'; return
  }

  sinkBusy.value  = true
  sinkError.value = ''
  const map = Array.from({ length: f.channels }, (_, i) => f.chStart + i)

  let body
  if (sinkTab.value === 'browse') {
    body = {
      name:               f.name.trim(),
      io:                 'Audio Device',
      use_sdp:            true,
      source:             'http://127.0.0.1/',
      sdp:                selectedRemote.value.sdp,
      delay:              f.delay,
      ignore_refclk_gmid: f.ignoreRefclk,
      map,
    }
  } else if (f.url.trim()) {
    body = {
      name:               f.name.trim(),
      io:                 'Audio Device',
      use_sdp:            false,
      source:             f.url.trim(),
      delay:              f.delay,
      ignore_refclk_gmid: f.ignoreRefclk,
      map,
    }
  } else {
    body = {
      name:               f.name.trim(),
      io:                 'Audio Device',
      use_sdp:            true,
      source:             'http://127.0.0.1/',
      sdp:                f.rawSdp.trim(),
      delay:              f.delay,
      ignore_refclk_gmid: f.ignoreRefclk,
      map,
    }
  }

  try {
    await api.put(`/aes67/sinks/${nextSinkId.value}`, body)
    showAddSink.value = false
    await fetchAll()
  } catch (e) { sinkError.value = e.response?.data?.error ?? 'Failed' }
  sinkBusy.value = false
}

// SDP에서 멀티캐스트 주소 파싱
function sdpAddress(sdp) {
  const m = (sdp ?? '').match(/c=IN IP4 ([^\s/]+)/)
  return m ? m[1] : null
}

function sdpCodec(sdp) {
  const m = (sdp ?? '').match(/a=rtpmap:\d+\s+(\S+)\/(\d+)(?:\/(\d+))?/)
  if (!m) return ''
  return `${m[1]} ${(Number(m[2]) / 1000).toFixed(0)}kHz ${m[3] ?? 1}ch`
}
</script>

<template>
  <q-page class="row justify-center q-pa-md">
    <div class="column q-gutter-md" style="width: 100%; max-width: 680px">

      <!-- Daemon + PTP status header -->
      <q-card flat style="border: 1px solid #e0e0e0">
        <q-card-section class="q-py-sm">
          <div class="row no-wrap justify-between items-center">
            <div class="row items-center q-gutter-x-sm">
              <span class="header-title">AES67</span>
              <q-badge :color="aes67.ready ? 'positive' : aes67.running ? 'warning' : 'grey-5'"
                outline>
                {{ aes67.ready ? 'Ready' : aes67.running ? 'Starting…' : 'Stopped' }}
              </q-badge>
            </div>
            <q-btn flat dense round size="sm"
              :icon="aes67.running ? 'stop_circle' : 'play_circle'"
              :color="aes67.running ? 'negative' : 'positive'"
              :loading="daemonBusy"
              @click="toggleDaemon">
              <q-tooltip>{{ aes67.running ? 'Stop Daemon' : 'Start Daemon' }}</q-tooltip>
            </q-btn>
          </div>
        </q-card-section>
        <q-separator />
        <q-card-section class="q-py-xs q-px-md">
          <div class="row items-center q-gutter-x-sm">
            <q-icon :name="ptpLocked ? 'gps_fixed' : 'gps_not_fixed'"
              :color="ptpLocked ? 'positive' : 'grey-5'" size="14px" />
            <span class="ptp-label" :class="ptpLocked ? 'ptp-locked' : 'ptp-unlocked'">
              PTP {{ ptpLabel }}
            </span>
          </div>
        </q-card-section>
      </q-card>

      <!-- ─── Sources (Output) ─── -->
      <div class="section-header">
        <span class="section-title">
          <q-icon name="upload" color="blue-7" size="16px" />
          Sources (출력)
        </span>
        <q-btn flat dense round size="sm" icon="add" color="blue-7"
          :disable="!aes67.ready"
          @click="openAddSource">
          <q-tooltip>Add Source</q-tooltip>
        </q-btn>
      </div>

      <Aes67SourcePanel
        v-for="src in sources" :key="src.id"
        :source="src"
        @refresh="fetchAll"
      />
      <div v-if="aes67.ready && !sources.length" class="empty-hint">
        <q-icon name="upload" size="32px" color="blue-grey-3" />
        <span>소스 없음</span>
      </div>
      <div v-if="!aes67.ready" class="empty-hint">
        <q-icon name="power_off" size="32px" color="blue-grey-3" />
        <span>AES67 데몬이 실행 중이 아닙니다</span>
      </div>

      <!-- ─── Sinks (Input) ─── -->
      <div class="section-header q-mt-sm">
        <span class="section-title">
          <q-icon name="download" color="green-7" size="16px" />
          Sinks (입력)
        </span>
        <q-btn flat dense round size="sm" icon="add" color="green-7"
          :disable="!aes67.ready"
          @click="openAddSink">
          <q-tooltip>Add Sink</q-tooltip>
        </q-btn>
      </div>

      <Aes67SinkPanel
        v-for="sk in sinks" :key="sk.id"
        :sink="sk"
        @refresh="fetchAll"
      />
      <div v-if="aes67.ready && !sinks.length" class="empty-hint">
        <q-icon name="download" size="32px" color="blue-grey-3" />
        <span>싱크 없음</span>
      </div>

    </div>

    <!-- ════ Add Source dialog ════ -->
    <q-dialog v-model="showAddSource" persistent>
      <q-card style="min-width: 400px">
        <q-card-section class="dialog-head">
          <span class="dialog-title">Add AES67 Source (출력)</span>
        </q-card-section>
        <q-separator />
        <q-card-section class="dialog-body">

          <div class="field-group">
            <label class="field-label">이름</label>
            <q-input v-model="srcForm.name" dense outlined placeholder="Source 이름" autofocus />
          </div>

          <div class="field-group">
            <label class="field-label">Multicast Address</label>
            <q-input v-model="srcForm.address" dense outlined
              placeholder="239.69.x.x" class="font-mono" />
          </div>

          <div class="field-group">
            <label class="field-label">Codec</label>
            <div class="seg-group">
              <button v-for="c in srcCodecOptions" :key="c"
                class="seg-btn" :class="{ 'seg-btn--on': srcForm.codec === c }"
                @click="srcForm.codec = c">{{ c }}</button>
            </div>
          </div>

          <div class="field-group">
            <label class="field-label">Samples / Packet (Ptime)</label>
            <div class="seg-group">
              <button v-for="n in srcSppOptions" :key="n"
                class="seg-btn seg-btn--sm" :class="{ 'seg-btn--on': srcForm.spp === n }"
                @click="srcForm.spp = n">{{ n }}</button>
            </div>
          </div>

          <div class="dlg-row">
            <div class="field-group" style="flex:1">
              <label class="field-label">채널 수</label>
              <q-input v-model.number="srcForm.channels" dense outlined type="number"
                :min="1" :max="8" />
            </div>
            <div class="field-group" style="flex:1">
              <label class="field-label">시작 채널 (0-based)</label>
              <q-input v-model.number="srcForm.chStart" dense outlined type="number"
                :min="0" :max="7" />
            </div>
          </div>

          <p v-if="srcError" class="form-error">{{ srcError }}</p>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right" class="dialog-actions">
          <q-btn flat label="취소" color="grey-7" v-close-popup />
          <q-btn unelevated label="추가" color="blue-7"
            :loading="srcBusy" @click="confirmAddSource" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- ════ Add Sink dialog ════ -->
    <q-dialog v-model="showAddSink" persistent>
      <q-card style="min-width: 460px; max-width: 95vw">
        <q-card-section class="dialog-head">
          <span class="dialog-title">Add AES67 Sink (입력)</span>
        </q-card-section>
        <q-separator />

        <!-- Tabs -->
        <q-tabs v-model="sinkTab" dense align="left" class="q-px-md q-pt-sm"
          active-color="primary" indicator-color="primary">
          <q-tab name="browse" label="네트워크 탐색" icon="wifi_find" />
          <q-tab name="url"    label="URL"          icon="link" />
          <q-tab name="sdp"    label="SDP 직접 입력" icon="code" />
        </q-tabs>
        <q-separator />

        <q-card-section class="dialog-body">

          <!-- Browse tab -->
          <q-tab-panels v-model="sinkTab" animated>
            <q-tab-panel name="browse" class="q-pa-none">
              <div class="browse-toolbar">
                <span class="browse-count">{{ browseList.length }}개 발견</span>
                <q-btn flat dense round size="sm" icon="refresh" color="grey-6"
                  :loading="browseBusy" @click="doBrowse" />
              </div>
              <div v-if="browseBusy" class="browse-loading">
                <q-spinner size="24px" color="primary" />
              </div>
              <div v-else-if="!browseList.length" class="browse-empty">
                네트워크에서 AES67 소스를 찾을 수 없습니다
              </div>
              <div v-else class="browse-list">
                <div
                  v-for="src in browseList" :key="src.id"
                  class="browse-card"
                  :class="{ 'browse-card--sel': selectedRemote?.id === src.id }"
                  @click="selectRemote(src)"
                >
                  <div class="browse-card-name">{{ src.name }}</div>
                  <div class="browse-card-meta">
                    <span class="meta-chip">{{ src.source }}</span>
                    <span v-if="sdpAddress(src.sdp)" class="meta-chip mono">{{ sdpAddress(src.sdp) }}</span>
                    <span v-if="sdpCodec(src.sdp)" class="meta-chip">{{ sdpCodec(src.sdp) }}</span>
                  </div>
                </div>
              </div>
            </q-tab-panel>

            <q-tab-panel name="url" class="q-pa-none">
              <div class="field-group q-pt-sm">
                <label class="field-label">SDP URL</label>
                <q-input v-model="sinkForm.url" dense outlined
                  placeholder="http://192.168.0.x:8080/api/source/sdp/0"
                  class="font-mono" />
              </div>
            </q-tab-panel>

            <q-tab-panel name="sdp" class="q-pa-none">
              <div class="field-group q-pt-sm">
                <label class="field-label">SDP 내용</label>
                <q-input v-model="sinkForm.rawSdp" dense outlined type="textarea"
                  rows="6" placeholder="v=0&#10;o=- ...&#10;s=..." class="font-mono" />
              </div>
            </q-tab-panel>
          </q-tab-panels>

          <q-separator class="q-my-sm" />

          <div class="field-group">
            <label class="field-label">이름</label>
            <q-input v-model="sinkForm.name" dense outlined placeholder="Sink 이름" />
          </div>

          <div class="dlg-row">
            <div class="field-group" style="flex:1">
              <label class="field-label">Delay (samples)</label>
              <q-input v-model.number="sinkForm.delay" dense outlined type="number" :min="0" />
            </div>
            <div class="field-group" style="flex:1">
              <label class="field-label">채널 수</label>
              <q-input v-model.number="sinkForm.channels" dense outlined type="number"
                :min="1" :max="8" />
            </div>
            <div class="field-group" style="flex:1">
              <label class="field-label">시작 채널</label>
              <q-input v-model.number="sinkForm.chStart" dense outlined type="number"
                :min="0" :max="7" />
            </div>
          </div>

          <q-toggle v-model="sinkForm.ignoreRefclk" label="GM ID 무시 (Ignore refclk GMID)"
            color="primary" dense />

          <p v-if="sinkError" class="form-error">{{ sinkError }}</p>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right" class="dialog-actions">
          <q-btn flat label="취소" color="grey-7" v-close-popup />
          <q-btn unelevated label="추가" color="green-7"
            :loading="sinkBusy" @click="confirmAddSink" />
        </q-card-actions>
      </q-card>
    </q-dialog>

  </q-page>
</template>

<style scoped>
.header-title { font-size: 16px; font-weight: 700; color: #37474f; }

.ptp-label  { font-size: 12px; font-weight: 600; }
.ptp-locked   { color: #2e7d32; }
.ptp-unlocked { color: #b0bec5; }

.section-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 4px 0;
}
.section-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 700; color: #546e7a;
  text-transform: uppercase; letter-spacing: 0.6px;
}

.empty-hint {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 24px; color: #b0bec5; font-size: 13px;
}

/* ── Dialog ── */
.dialog-head    { padding: 14px 20px; }
.dialog-title   { font-size: 15px; font-weight: 700; color: #37474f; }
.dialog-body    { display: flex; flex-direction: column; gap: 14px; padding: 16px 20px; }
.dialog-actions { padding: 8px 16px 12px; }
.dlg-row  { display: flex; gap: 10px; align-items: flex-end; }
.field-group { display: flex; flex-direction: column; gap: 6px; }
.field-label {
  font-size: 11px; font-weight: 700; color: #90a4ae;
  letter-spacing: 0.5px; text-transform: uppercase;
}
.form-error { margin: 0; font-size: 12px; color: #c62828; font-weight: 600; }

.seg-group { display: flex; gap: 5px; flex-wrap: wrap; }
.seg-btn {
  background: #f5f5f5; border: 1px solid #cfd8dc; border-radius: 3px;
  padding: 6px 13px; font-size: 13px; font-weight: 600; color: #546e7a;
  cursor: pointer; transition: background 0.1s, color 0.1s;
}
.seg-btn--sm  { padding: 5px 10px; font-size: 12px; }
.seg-btn:hover { background: #e3f2fd; border-color: #90caf9; }
.seg-btn--on   { background: #1565c0; border-color: #1565c0; color: #fff; }

.font-mono { font-family: 'Courier New', monospace; }

/* ── Browse ── */
.browse-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 4px 0 8px; font-size: 12px; color: #90a4ae;
}
.browse-count  { font-weight: 600; }
.browse-loading, .browse-empty {
  display: flex; justify-content: center; align-items: center;
  padding: 24px; color: #b0bec5; font-size: 13px;
}
.browse-list { display: flex; flex-direction: column; gap: 6px; max-height: 240px; overflow-y: auto; }
.browse-card {
  border: 1px solid #e0e0e0; border-radius: 4px; padding: 10px 12px;
  cursor: pointer; transition: background 0.1s, border-color 0.1s;
}
.browse-card:hover { background: #f5f9ff; border-color: #90caf9; }
.browse-card--sel  { background: #e3f2fd; border-color: #1565c0; }
.browse-card-name  { font-size: 13px; font-weight: 700; color: #37474f; margin-bottom: 4px; }
.browse-card-meta  { display: flex; gap: 5px; flex-wrap: wrap; }
.meta-chip {
  font-size: 10px; font-weight: 600; padding: 1px 6px;
  border-radius: 3px; background: #f5f5f5; color: #546e7a; border: 1px solid #e0e0e0;
}
.mono { font-family: 'Courier New', monospace; }
</style>
