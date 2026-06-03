<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAoipStore } from 'src/stores/aoip'
import { useSettingsStore } from 'src/stores/settings'

const { t } = useI18n()
const aoip     = useAoipStore()
const settings = useSettingsStore()

const sections = computed(() => [
  { key: 'engine',      title: t('raw.engine'),      data: aoip.engine },
  { key: 'aes67',       title: t('raw.aes67'),       data: aoip.aes67 },
  { key: 'ptp',         title: t('raw.ptp'),         data: aoip.aes67PtpStatus },
  { key: 'sources',     title: t('raw.sources'),     data: aoip.aes67Sources },
  { key: 'sinks',       title: t('raw.sinks'),       data: aoip.aes67Sinks },
  { key: 'streams',     title: t('raw.streams'),     data: aoip.streams },
  { key: 'bridges',     title: t('raw.bridges'),     data: aoip.bridges },
  { key: 'connections', title: t('raw.connections'), data: aoip.connections },
  { key: 'channels',    title: t('raw.channels'),    data: aoip.channels },
  { key: 'rxStats',     title: t('raw.rxStats'),     data: aoip.rxStats },
  { key: 'settings',    title: t('raw.settings'),    data: settings.$state },
])

const STORAGE_KEY = 'raw-page-open'

function loadOpen() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? new Set(JSON.parse(saved)) : new Set()
  } catch { return new Set() }
}

const open = ref(loadOpen())

function toggle(key) {
  open.value.has(key) ? open.value.delete(key) : open.value.add(key)
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...open.value]))
}
</script>

<template>
  <q-page class="q-pa-md raw-page">
    <div class="raw-page-title">{{ t('raw.title') }}</div>
    <div class="raw-list">
      <div v-for="sec in sections" :key="sec.key" class="raw-card">
        <button class="raw-card-header" @click="toggle(sec.key)">
          <span class="raw-card-title">{{ sec.title }}</span>
          <q-icon
            :name="open.has(sec.key) ? 'expand_less' : 'expand_more'"
            size="16px"
            color="white"
          />
        </button>
        <pre v-if="open.has(sec.key)" class="raw-json">{{ JSON.stringify(sec.data, null, 2) }}</pre>
      </div>
    </div>
  </q-page>
</template>

<style scoped>
.raw-page { background: #f5f7fa; min-height: 100vh; }

.raw-page-title {
  font-size: 12px;
  font-weight: 700;
  color: #90a4ae;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  margin-bottom: 12px;
}

.raw-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 800px;
}

.raw-card {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
}

.raw-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: #546e7a;
  border: none;
  padding: 7px 12px;
  cursor: pointer;
  user-select: none;
}
.raw-card-header:hover { background: #455a64; }

.raw-card-title {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.6px;
  text-transform: uppercase;
}

.raw-json {
  font-family: 'Courier New', monospace;
  font-size: 11px;
  color: #37474f;
  padding: 10px 12px;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
  max-height: 400px;
  overflow-y: auto;
}
</style>
