<script setup>
import { computed } from 'vue'
import { socket } from 'src/boot/socket'
import { useAoipStore } from 'src/stores/aoip'

const aoipState = useAoipStore()

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  routeTarget: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue'])

const dialogOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const inputGroups = computed(() => {
  const chs = aoipState.channels.inputs
  const groups = []
  let i = 0
  while (i < chs.length) {
    const ch = chs[i]
    if (ch.label.toLowerCase().includes('analog')) {
      groups.push({ stereo: false, ch })
      i++
    } else {
      const next = chs[i + 1]
      if (next && !next.label.toLowerCase().includes('analog')) {
        groups.push({ stereo: true, left: ch, right: next })
        i += 2
      } else {
        groups.push({ stereo: false, ch })
        i++
      }
    }
  }
  return groups
})

function isConnected(inputPort, outputPort) {
  const entry = aoipState.jack.connections.find((c) => c.port === inputPort)
  return entry ? entry.connections.includes(outputPort) : false
}

function toggleConnection(inputPort, outputPort) {
  if (isConnected(inputPort, outputPort)) {
    socket.emit('jack:disconnect', { src: inputPort, dst: outputPort })
  } else {
    socket.emit('jack:connect', { src: inputPort, dst: outputPort })
  }
}

function inputTypeTag(label) {
  const l = label.toLowerCase()
  if (l.includes('analog')) return { text: 'ANA', color: '#1976d2' }
  if (l.includes('aes67')) return { text: 'AES', color: '#7b1fa2' }
  if (l.includes('usb')) return { text: 'USB', color: '#388e3c' }
  return { text: label.substring(0, 3).toUpperCase(), color: '#546e7a' }
}

function routeInputLabel(group) {
  if (!group.stereo) return group.ch.label
  return group.left.label.replace(/\s*(CH\d+|[LR]|\d+)$/i, '').trim()
}

function stereoLabel(left) {
  return left.label.replace(/\s*(CH\d+|[LR]|\d+)$/i, '').trim()
}

function groupKey(group) {
  return group.stereo ? group.left.id : group.ch.id
}

function isInConnected(inCh, outGroup) {
  if (outGroup.stereo) return isConnected(inCh.jackPort, outGroup.left.jackPort)
  return isConnected(inCh.jackPort, outGroup.ch.jackPort)
}

function toggleForGroup(inCh, outGroup) {
  if (outGroup.stereo) {
    toggleConnection(inCh.jackPort, outGroup.left.jackPort)
    toggleConnection(inCh.jackPort, outGroup.right.jackPort)
  } else {
    toggleConnection(inCh.jackPort, outGroup.ch.jackPort)
  }
}
</script>

<template>
  <q-dialog v-model="dialogOpen">
    <q-card class="route-dialog">
      <q-card-section class="route-dialog-header">
        <span class="route-dialog-title">
          {{
            routeTarget
              ? routeTarget.stereo
                ? stereoLabel(routeTarget.left)
                : routeTarget.ch.label
              : ''
          }}
        </span>
        <q-btn flat dense round icon="close" size="sm" v-close-popup />
      </q-card-section>
      <!-- 스테레오 출력: L섹션(상단) / R섹션(하단) 분리 -->
      <template v-if="routeTarget && routeTarget.stereo">
        <q-card-section class="route-dialog-section-label">
          {{ stereoLabel(routeTarget.left) }} L
        </q-card-section>
        <q-card-section class="route-dialog-body">
          <template v-for="inGroup in inputGroups" :key="'L-' + groupKey(inGroup)">
            <template v-if="inGroup.stereo">
              <button
                class="route-ch-btn"
                :class="{ active: isConnected(inGroup.left.jackPort, routeTarget.left.jackPort) }"
                @click="toggleConnection(inGroup.left.jackPort, routeTarget.left.jackPort)"
              >
                <span
                  class="route-ch-tag"
                  :style="`background:${inputTypeTag(inGroup.left.label).color}`"
                  >{{ inputTypeTag(inGroup.left.label).text }}</span
                >
                <span class="route-ch-name">{{ routeInputLabel(inGroup) }} L</span>
              </button>
              <button
                class="route-ch-btn"
                :class="{
                  active: isConnected(inGroup.right.jackPort, routeTarget.left.jackPort),
                }"
                @click="toggleConnection(inGroup.right.jackPort, routeTarget.left.jackPort)"
              >
                <span
                  class="route-ch-tag"
                  :style="`background:${inputTypeTag(inGroup.right.label).color}`"
                  >{{ inputTypeTag(inGroup.right.label).text }}</span
                >
                <span class="route-ch-name">{{ routeInputLabel(inGroup) }} R</span>
              </button>
            </template>
            <template v-else>
              <button
                class="route-ch-btn"
                :class="{ active: isConnected(inGroup.ch.jackPort, routeTarget.left.jackPort) }"
                @click="toggleConnection(inGroup.ch.jackPort, routeTarget.left.jackPort)"
              >
                <span
                  class="route-ch-tag"
                  :style="`background:${inputTypeTag(inGroup.ch.label).color}`"
                  >{{ inputTypeTag(inGroup.ch.label).text }}</span
                >
                <span class="route-ch-name">{{ inGroup.ch.label }}</span>
              </button>
            </template>
          </template>
        </q-card-section>
        <q-separator />
        <q-card-section class="route-dialog-section-label">
          {{ stereoLabel(routeTarget.left) }} R
        </q-card-section>
        <q-card-section class="route-dialog-body">
          <template v-for="inGroup in inputGroups" :key="'R-' + groupKey(inGroup)">
            <template v-if="inGroup.stereo">
              <button
                class="route-ch-btn"
                :class="{
                  active: isConnected(inGroup.left.jackPort, routeTarget.right.jackPort),
                }"
                @click="toggleConnection(inGroup.left.jackPort, routeTarget.right.jackPort)"
              >
                <span
                  class="route-ch-tag"
                  :style="`background:${inputTypeTag(inGroup.left.label).color}`"
                  >{{ inputTypeTag(inGroup.left.label).text }}</span
                >
                <span class="route-ch-name">{{ routeInputLabel(inGroup) }} L</span>
              </button>
              <button
                class="route-ch-btn"
                :class="{
                  active: isConnected(inGroup.right.jackPort, routeTarget.right.jackPort),
                }"
                @click="toggleConnection(inGroup.right.jackPort, routeTarget.right.jackPort)"
              >
                <span
                  class="route-ch-tag"
                  :style="`background:${inputTypeTag(inGroup.right.label).color}`"
                  >{{ inputTypeTag(inGroup.right.label).text }}</span
                >
                <span class="route-ch-name">{{ routeInputLabel(inGroup) }} R</span>
              </button>
            </template>
            <template v-else>
              <button
                class="route-ch-btn"
                :class="{ active: isConnected(inGroup.ch.jackPort, routeTarget.right.jackPort) }"
                @click="toggleConnection(inGroup.ch.jackPort, routeTarget.right.jackPort)"
              >
                <span
                  class="route-ch-tag"
                  :style="`background:${inputTypeTag(inGroup.ch.label).color}`"
                  >{{ inputTypeTag(inGroup.ch.label).text }}</span
                >
                <span class="route-ch-name">{{ inGroup.ch.label }}</span>
              </button>
            </template>
          </template>
        </q-card-section>
      </template>

      <!-- 모노 출력: 단일 섹션 -->
      <q-card-section v-else class="route-dialog-body">
        <template v-for="inGroup in inputGroups" :key="groupKey(inGroup)">
          <template v-if="inGroup.stereo">
            <button
              class="route-ch-btn"
              :class="{ active: routeTarget && isInConnected(inGroup.left, routeTarget) }"
              @click="routeTarget && toggleForGroup(inGroup.left, routeTarget)"
            >
              <span
                class="route-ch-tag"
                :style="`background:${inputTypeTag(inGroup.left.label).color}`"
                >{{ inputTypeTag(inGroup.left.label).text }}</span
              >
              <span class="route-ch-name">{{ routeInputLabel(inGroup) }} L</span>
            </button>
            <button
              class="route-ch-btn"
              :class="{ active: routeTarget && isInConnected(inGroup.right, routeTarget) }"
              @click="routeTarget && toggleForGroup(inGroup.right, routeTarget)"
            >
              <span
                class="route-ch-tag"
                :style="`background:${inputTypeTag(inGroup.right.label).color}`"
                >{{ inputTypeTag(inGroup.right.label).text }}</span
              >
              <span class="route-ch-name">{{ routeInputLabel(inGroup) }} R</span>
            </button>
          </template>
          <template v-else>
            <button
              class="route-ch-btn"
              :class="{ active: routeTarget && isInConnected(inGroup.ch, routeTarget) }"
              @click="routeTarget && toggleForGroup(inGroup.ch, routeTarget)"
            >
              <span
                class="route-ch-tag"
                :style="`background:${inputTypeTag(inGroup.ch.label).color}`"
                >{{ inputTypeTag(inGroup.ch.label).text }}</span
              >
              <span class="route-ch-name">{{ inGroup.ch.label }}</span>
            </button>
          </template>
        </template>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style scoped>
/* 라우팅 팝업 */
.route-dialog {
  min-width: 320px;
  max-width: 500px;
  margin: auto;
}
.route-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px 8px;
  border-bottom: 1px solid #e4e6ea;
}
.route-dialog-title {
  font-size: 13px;
  font-weight: 700;
  color: #37474f;
}
.route-dialog-section-label {
  font-size: 11px;
  font-weight: 700;
  color: #78909c;
  letter-spacing: 1px;
  text-transform: uppercase;
  padding: 8px 14px 4px;
}
.route-dialog-body {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  padding: 14px;
}
.route-ch-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f5f5f5;
  border: 1px solid #cfd8dc;
  border-radius: 5px;
  padding: 6px 10px;
  cursor: pointer;
  transition:
    background 0.1s,
    border-color 0.1s;
}
.route-ch-btn:hover {
  background: #e0e0e0;
  border-color: #90a4ae;
}
.route-ch-btn.active {
  background: #1565c0;
  border-color: #1565c0;
}
.route-ch-btn.active .route-ch-name {
  color: #fff;
}
.route-ch-tag {
  font-size: 8px;
  font-weight: 800;
  color: #fff;
  padding: 2px 5px;
  border-radius: 3px;
  flex-shrink: 0;
}
.route-ch-name {
  font-size: 11px;
  font-weight: 600;
  color: #37474f;
  white-space: nowrap;
}
</style>
