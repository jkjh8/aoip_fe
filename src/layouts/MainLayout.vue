<template>
  <q-layout view="hHh LpR fFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn flat dense round icon="menu" aria-label="Menu" @click="miniMode = !miniMode" />
        <q-toolbar-title>
          <span> AOIP </span>
          <span class="text-caption text-weight-light"> Audio over IP </span>
        </q-toolbar-title>
        <div class="text-caption text-weight-light q-pr-sm">Audio Streaming Converter</div>
        <q-btn flat dense round icon="grid_on" color="white" @click="matrixOpen = true">
          <q-tooltip anchor="bottom middle" self="top middle" :offset="[0, 4]">Crosspoint Matrix</q-tooltip>
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
import { ref } from 'vue'
import EssentialLink from 'components/EssentialLink.vue'
import MatrixDialog from 'src/components/mixer/MatrixDialog.vue'

const miniMode = ref(true)
const matrixOpen = ref(false)

const linksList = [
  { title: 'Matrix',   caption: 'Audio Mixer',         icon: 'hub',     link: '/matrix' },
  { title: 'Stream',   caption: 'Streaming Settings',  icon: 'stream',       link: '/stream' },
  { title: 'AES67',   caption: 'AES67 Sources/Sinks', icon: 'settings_ethernet', link: '/aes67' },
  { title: 'Devices',  caption: 'Audio Interfaces',   icon: 'devices',      link: '/devices' },
  { title: 'Settings', caption: 'Application Settings',icon: 'settings',link: '/settings' },
  { title: 'Raw',      caption: 'Pinia Raw State',     icon: 'data_object', link: '/raw' },
]
</script>
