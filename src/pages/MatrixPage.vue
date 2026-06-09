<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { socket } from 'src/boot/socket'
import { useAoipStore } from 'src/stores/aoip'

const aoipState = useAoipStore()
const { t } = useI18n()

const inputs = computed(() => aoipState.filteredInputs)
const outputs = computed(() => aoipState.filteredOutputs)

function isConnected(inPort, outPort) {
  const entry = aoipState.connections.find((c) => c.port === inPort)
  return entry ? entry.connections.includes(outPort) : false
}

function toggle(inPort, outPort) {
  if (isConnected(inPort, outPort)) {
    socket.emit('route:remove', { src: inPort, dst: outPort })
  } else {
    socket.emit('route:add', { src: inPort, dst: outPort })
  }
}

function typeColor(label) {
  const l = label.toLowerCase()
  if (l.includes('analog')) return '#1976d2'
  if (l.includes('aes67')) return '#7b1fa2'
  if (l.includes('stream')) return '#2e7d32'
  return '#546e7a'
}

function typeTag(label) {
  const l = label.toLowerCase()
  if (l.includes('analog')) return 'ANA'
  if (l.includes('aes67')) return 'AES'
  if (l.includes('stream')) return 'STR'
  return label.substring(0, 3).toUpperCase()
}

function shortLabel(label) {
  const parts = label.trim().split(/\s+/)
  return parts[parts.length - 1]
}

function buildLabelMap(channels) {
  const map = new Map()
  let strCount = 0
  channels.forEach((ch) => {
    if (typeTag(ch.label) === 'STR') {
      map.set(ch.id, String(++strCount))
    } else {
      map.set(ch.id, shortLabel(ch.label))
    }
  })
  return map
}

const inputLabelMap = computed(() => buildLabelMap(inputs.value))
const outputLabelMap = computed(() => buildLabelMap(outputs.value))
</script>

<template>
  <q-page>
    <div v-if="!aoipState.connected" class="row justify-center q-mt-xl">
      <q-chip color="negative" text-color="white" icon="wifi_off">{{ t('errors.lostConnection') }}</q-chip>
    </div>

    <div v-else class="q-pa-md">
      <div class="text-subtitle2 q-mb-sm">{{ t('matrix.title') }}</div>
      <div class="mx-scroll">
        <table class="mx-table">
          <thead>
            <tr>
              <th class="mx-corner">
                <div class="mx-corner-inner">
                  <span class="mx-axis mx-axis--out">{{ t('matrix.outputAxis') }}</span>
                  <div class="mx-corner-line" />
                  <span class="mx-axis mx-axis--in">{{ t('matrix.inputAxis') }}</span>
                </div>
              </th>
              <th v-for="out in outputs" :key="out.id" class="mx-col-head">
                <div class="mx-col-inner">
                  <span class="mx-col-tag" :style="{ background: typeColor(out.label) }">
                    {{ typeTag(out.label) }}
                  </span>
                  <span class="mx-col-label">{{ outputLabelMap.get(out.id) }}</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="inp in inputs" :key="inp.id">
              <td class="mx-row-head">
                <span class="mx-col-tag" :style="{ background: typeColor(inp.label) }">
                  {{ typeTag(inp.label) }}
                </span>
                <span class="mx-col-label">{{ inputLabelMap.get(inp.id) }}</span>
              </td>
              <td
                v-for="out in outputs"
                :key="out.id"
                class="mx-cell"
                :class="{ 'mx-cell--on': isConnected(inp.port, out.port) }"
                :style="{ '--cell-color': typeColor(out.label) }"
                @click="toggle(inp.port, out.port)"
              />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </q-page>
</template>

<style scoped>
.mx-scroll {
  overflow: auto;
}

.mx-table {
  border-collapse: separate;
  border-spacing: 3px;
}

.mx-corner {
  width: 50px;
  min-width: 50px;
  vertical-align: bottom;
  padding-bottom: 6px;
}
.mx-corner-inner {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
.mx-axis {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.4px;
}
.mx-axis--out {
  color: #1565c0;
  align-self: flex-end;
}
.mx-axis--in {
  color: #2e7d32;
  align-self: flex-start;
}
.mx-corner-line {
  width: 100%;
  height: 1px;
  background: linear-gradient(to right, #2e7d32 40%, #1565c0 60%);
  opacity: 0.4;
}

.mx-col-tag {
  font-size: 9px;
  font-weight: 800;
  color: #fff;
  padding: 2px 5px;
  border-radius: 2px;
  flex-shrink: 0;
}
.mx-col-label {
  font-size: 12px;
  font-weight: 600;
  color: #37474f;
  white-space: nowrap;
}

.mx-col-head {
  width: 30px;
  min-width: 30px;
  padding: 0 0 6px;
  vertical-align: bottom;
  text-align: center;
}
.mx-col-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.mx-row-head {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 10px 0 0;
  height: 30px;
  white-space: nowrap;
}

.mx-cell {
  width: 30px;
  height: 30px;
  text-align: center;
  vertical-align: middle;
  cursor: pointer;
  border-radius: 3px;
  background: #f0f2f5;
  transition: background 0.1s;
}
.mx-cell:hover {
  background: #dce3ea;
}
.mx-cell--on {
  background: var(--cell-color, #1565c0);
}
.mx-cell--on:hover {
  background: var(--cell-color, #1565c0);
  filter: brightness(1.15);
}
</style>
