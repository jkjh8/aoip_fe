<template>
  <q-layout view="hHh LpR fFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn flat dense round icon="menu" aria-label="Menu" @click="miniMode = !miniMode" />
        <q-toolbar-title>
          <span> {{ t('header.title') }} </span>
          <span class="text-caption text-weight-light"> {{ t('header.subtitle') }} </span>
        </q-toolbar-title>
        <div class="text-caption text-weight-light q-pr-sm">{{ t('header.description') }}</div>

        <q-btn flat dense :label="localeLabel" icon="language">
          <q-menu>
            <q-list dense style="min-width: 120px">
              <q-item
                v-for="opt in localeOptions"
                :key="opt.value"
                clickable
                v-close-popup
                :active="locale === opt.value"
                @click="changeLocale(opt.value)"
              >
                <q-item-section>{{ opt.label }}</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>

        <q-btn flat dense round icon="grid_on" color="white" @click="matrixOpen = true">
          <q-tooltip anchor="bottom middle" self="top middle" :offset="[0, 4]">{{ t('nav.matrix') }}</q-tooltip>
        </q-btn>
      </q-toolbar>
    </q-header>
    <MatrixDialog v-model="matrixOpen" />

    <q-drawer
      bordered
      persistent
      :model-value="true"
      :breakpoint="0"
      :mini="miniMode"
      :width="200"
      :mini-width="56"
    >
      <q-list>
        <EssentialLink
          v-for="link in linksList"
          :key="link.title"
          v-bind="link"
          :show-text="!miniMode"
        />
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import EssentialLink from 'components/EssentialLink.vue'
import MatrixDialog from 'src/components/mixer/MatrixDialog.vue'
import { setLocale } from 'src/boot/i18n'

const { t, locale } = useI18n()

const miniMode = ref(true)
const matrixOpen = ref(false)

const localeOptions = [
  { value: 'en-US', label: 'English' },
  { value: 'ko-KR', label: '한국어' },
]
const localeLabel = computed(() => (locale.value === 'ko-KR' ? 'KO' : 'EN'))
function changeLocale(v) { setLocale(v) }

const linksList = computed(() => [
  { title: 'Matrix',   caption: t('nav.audioMixer'),  icon: 'hub',     link: '/matrix' },
  { title: 'Stream',   caption: t('nav.streaming'),   icon: 'stream',       link: '/stream' },
  { title: 'AES67',    caption: t('nav.aes67'),       icon: 'settings_ethernet', link: '/aes67' },
  { title: 'Devices',  caption: t('nav.devices'),     icon: 'devices',      link: '/devices' },
  { title: 'Settings', caption: t('nav.settings'),    icon: 'settings', link: '/settings' },
  { title: 'Raw',      caption: t('nav.rawState'),    icon: 'data_object', link: '/raw' },
])
</script>
