<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn flat dense round icon="menu" aria-label="Menu" @click="miniMode = !miniMode" />
        <q-toolbar-title>
          <span> AOIP </span>
          <span class="text-caption text-weight-light"> Audio over IP </span>
        </q-toolbar-title>
        <div class="text-caption text-weight-light q-pr-sm">Audio Streaming Converter</div>
      </q-toolbar>
    </q-header>

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

const miniMode = ref(true)

const linksList = [
  { title: 'Matrix',   caption: 'Audio Mixer',         icon: 'hub',     link: '/matrix' },
  { title: 'Stream',   caption: 'Streaming Settings',  icon: 'stream',  link: '/stream' },
  { title: 'Devices',  caption: 'Audio Interfaces',    icon: 'devices', link: '/devices' },
  { title: 'Settings', caption: 'Application Settings',icon: 'settings',link: '/settings' },
]
</script>
