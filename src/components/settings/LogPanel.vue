<script setup>
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'
import { useSettingsStore } from 'src/stores/settings.js'

const { t } = useI18n()
const store = useSettingsStore()
const $q = useQuasar()
const { log, logLoading, logSaving } = storeToRefs(store)

onMounted(() => store.fetchLog())

async function update(field, val) {
  const prev = log.value[field]
  log.value[field] = val
  const res = await store.saveLog({ [field]: val })
  if (res?.ok) {
    $q.notify({ type: 'positive', message: t('settings.logSaved') })
  } else {
    log.value[field] = prev
    $q.notify({ type: 'negative', message: res?.error ?? t('errors.saveFailed') })
  }
}
</script>

<template>
  <q-card flat bordered>
    <q-card-section class="row no-wrap justify-between items-center q-px-lgs">
      <div class="row q-gutter-x-xs items-center">
        <q-icon name="article" size="20px" color="blue-grey-7" />
        <span class="st-panel-title">{{ t('settings.log') }}</span>
      </div>
      <q-spinner v-if="logLoading" size="16px" color="blue-grey-7" />
    </q-card-section>
    <q-separator />
    <q-card-section>
      <div class="row no-wrap justify-between items-center">
        <span class="row-label">{{ t('settings.logEnabled') }}</span>
        <q-toggle
          :model-value="log.enabled"
          :disable="logSaving || logLoading"
          size="lg"
          color="blue-7"
          unchecked-icon="clear"
          checked-icon="check"
          @update:model-value="(v) => update('enabled', v)"
        />
      </div>
      <div class="row no-wrap justify-between items-center">
        <span class="row-label">{{ t('settings.debugMode') }}</span>
        <q-toggle
          :model-value="log.debug"
          :disable="logSaving || logLoading"
          size="lg"
          color="deep-orange-7"
          unchecked-icon="clear"
          checked-icon="bug_report"
          @update:model-value="(v) => update('debug', v)"
        />
      </div>
    </q-card-section>
  </q-card>
</template>
