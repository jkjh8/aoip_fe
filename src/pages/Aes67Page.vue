<script setup>
import { computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { socket } from 'src/boot/socket'
import { useAoipStore } from 'src/stores/aoip'
import Aes67SourcePanel from 'src/components/aes67/Aes67SourcePanel.vue'
import Aes67SinkPanel from 'src/components/aes67/Aes67SinkPanel.vue'
import Aes67SinkAddDialog from 'src/components/aes67/Aes67SinkAddDialog.vue'
import Aes67SourceAddDialog from 'src/components/aes67/Aes67SourceAddDialog.vue'

const $q = useQuasar()
const { t } = useI18n()
const aoipState = useAoipStore()

// ── Data 로드 ─────────────────────────────────────────────
function fetchSources() {
  socket.emit('aes67:sources:list', (res) => {
    if (res?.ok) aoipState.aes67Sources = res.sources ?? []
  })
}
function fetchSinks() {
  socket.emit('aes67:sinks:list', (res) => {
    if (res?.ok) aoipState.aes67Sinks = res.sinks ?? []
  })
}
function fetchAll() { fetchSources(); fetchSinks() }

onMounted(fetchAll)

const sources = computed(() => aoipState.aes67Sources)
const sinks   = computed(() => aoipState.aes67Sinks)
const ptpStatus = computed(() => aoipState.aes67PtpStatus)

const aes67 = computed(() => aoipState.aes67 ?? { running: false, ready: false })

// ── PTP display ───────────────────────────────────────────
const ptpLocked = computed(() => ptpStatus.value?.status === 'locked')
const ptpLabel = computed(() => {
  if (!ptpStatus.value) return '—'
  const { status, gmid, jitter } = ptpStatus.value
  if (status === 'locked') return `Locked · GM ${gmid} · ${jitter}ns`
  return status ?? 'Unknown'
})

function hasAvailableSlot(items) {
  const used = new Set(items.flatMap((s) => s.map ?? []))
  for (let i = 0; i < 16; i += 2)
    if (!used.has(i) && !used.has(i + 1)) return true
  return false
}

function openAddSink() {
  if (!hasAvailableSlot(sinks.value)) {
    $q.notify({ type: 'negative', message: t('errors.noChannelSlots') })
    return
  }
  $q.dialog({ component: Aes67SinkAddDialog }).onOk(() => fetchSinks())
}

function openAddSource() {
  if (!hasAvailableSlot(sources.value)) {
    $q.notify({ type: 'negative', message: t('errors.noChannelSlots') })
    return
  }
  $q.dialog({ component: Aes67SourceAddDialog }).onOk(() => fetchSources())
}
</script>

<template>
  <q-page class="q-pa-md">

    <!-- ─── Daemon + PTP status header ─── -->
    <q-card flat style="border: 1px solid #e0e0e0; max-width: 1160px; margin-bottom: 16px">
      <q-card-section class="q-py-sm" style="min-height: 52px; display: flex; align-items: center;">
        <div class="row no-wrap justify-between items-center" style="width:100%">
          <div class="row items-center q-gutter-x-sm">
            <span class="header-title">{{ t('aes67.title') }}</span>
            <q-badge
              :color="aes67.ready ? 'positive' : aes67.running ? 'warning' : 'grey-5'"
              outline
            >
              {{ aes67.ready ? t('common.ready') : aes67.running ? t('common.starting') : t('common.stopped') }}
            </q-badge>
          </div>
        </div>
      </q-card-section>
      <q-separator />
      <q-card-section class="q-py-xs q-px-md">
        <div class="row items-center q-gutter-x-sm">
          <q-icon
            :name="ptpLocked ? 'gps_fixed' : 'gps_not_fixed'"
            :color="ptpLocked ? 'positive' : 'grey-5'"
            size="14px"
          />
          <span class="ptp-label" :class="ptpLocked ? 'ptp-locked' : 'ptp-unlocked'">
            {{ t('aes67.ptp') }} {{ ptpLabel }}
          </span>
        </div>
      </q-card-section>
    </q-card>

    <!-- ─── 입출력 컬럼 ─── -->
    <div style="max-width: 1160px">
    <div class="row q-gutter-md items-start">

      <!-- Sinks (Input) -->
      <div class="col aes67-col">
        <div class="col-label">
          <q-icon name="download" size="16px" color="green-7" />
          {{ t('aes67.sinksInput') }}
          <q-btn flat dense round size="xs" icon="add" color="green-7"
            :disable="!aes67.ready" @click="openAddSink" style="margin-left: auto; margin-right: -4px">
            <q-tooltip>{{ t('aes67.addSink') }}</q-tooltip>
          </q-btn>
        </div>
        <div class="column q-gutter-sm">
          <Aes67SinkPanel v-for="sk in sinks" :key="sk.id" :sink="sk" @refresh="fetchSinks" />
          <div v-if="aes67.ready && !sinks.length" class="empty-hint">
            <q-icon name="download" size="32px" color="blue-grey-3" />
            <span>{{ t('aes67.noSinks') }}</span>
          </div>
          <div v-if="!aes67.ready" class="empty-hint">
            <q-icon name="power_off" size="32px" color="blue-grey-3" />
            <span>{{ t('aes67.daemonOffline') }}</span>
          </div>
        </div>
      </div>

      <!-- Sources (Output) -->
      <div class="col aes67-col">
        <div class="col-label">
          <q-icon name="upload" size="16px" color="blue-7" />
          {{ t('aes67.sourcesOutput') }}
          <q-btn flat dense round size="xs" icon="add" color="blue-7"
            :disable="!aes67.ready" @click="openAddSource" style="margin-left: auto; margin-right: -4px">
            <q-tooltip>{{ t('aes67.addSource') }}</q-tooltip>
          </q-btn>
        </div>
        <div class="column q-gutter-sm">
          <Aes67SourcePanel v-for="src in sources" :key="src.id" :source="src" @refresh="fetchSources" />
          <div v-if="aes67.ready && !sources.length" class="empty-hint">
            <q-icon name="upload" size="32px" color="blue-grey-3" />
            <span>{{ t('aes67.noSources') }}</span>
          </div>
          <div v-if="!aes67.ready" class="empty-hint">
            <q-icon name="power_off" size="32px" color="blue-grey-3" />
            <span>{{ t('aes67.daemonOffline') }}</span>
          </div>
        </div>
      </div>

    </div>
    </div>

  </q-page>
</template>

<style scoped>
.header-title {
  font-size: 16px;
  font-weight: 700;
  color: #37474f;
}

.ptp-label {
  font-size: 12px;
  font-weight: 600;
}
.ptp-locked {
  color: #2e7d32;
}
.ptp-unlocked {
  color: #b0bec5;
}

.aes67-col {
  max-width: 560px;
}
.col-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #78909c;
  margin-bottom: 8px;
}

.empty-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px;
  color: #b0bec5;
  font-size: 13px;
}

</style>
