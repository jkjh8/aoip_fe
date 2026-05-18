<script setup>
import { computed } from 'vue'
import { socket } from 'src/boot/socket'
import { useAoipStore } from 'src/stores/aoip'
import { useChannelPanel } from 'src/composables/useChannelPanel'

const aoipState = useAoipStore()
const { channelGroups: inputGroups, groupLabel, groupKey, typeTag } = useChannelPanel('input')

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

function isConnected(inputPort, outputPort) {
  const entry = aoipState.connections.find((c) => c.port === inputPort)
  return entry ? entry.connections.includes(outputPort) : false
}

function toggleConnection(inputPort, outputPort) {
  if (isConnected(inputPort, outputPort)) {
    socket.emit('route:remove', { src: inputPort, dst: outputPort })
  } else {
    socket.emit('route:add', { src: inputPort, dst: outputPort })
  }
}

function isInConnected(inCh, outGroup) {
  if (outGroup.stereo) return isConnected(inCh.port, outGroup.left.port)
  return isConnected(inCh.port, outGroup.ch.port)
}

function toggleForGroup(inCh, outGroup) {
  if (outGroup.stereo) {
    toggleConnection(inCh.port, outGroup.left.port)
    toggleConnection(inCh.port, outGroup.right.port)
  } else {
    toggleConnection(inCh.port, outGroup.ch.port)
  }
}
</script>

<template>
  <q-dialog v-model="dialogOpen">
    <q-card class="route-dialog">
      <q-card-section class="route-dialog-header">
        <span class="item-title">{{ routeTarget ? groupLabel(routeTarget) : '' }}</span>
        <q-btn flat dense round icon="close" size="sm" v-close-popup />
      </q-card-section>
      <!-- 스테레오 출력: L섹션(상단) / R섹션(하단) 분리 -->
      <template v-if="routeTarget && routeTarget.stereo">
        <q-card-section class="route-dialog-section-label">
          {{ groupLabel(routeTarget) }} L
        </q-card-section>
        <q-card-section class="route-dialog-body">
          <template v-for="inGroup in inputGroups" :key="'L-' + groupKey(inGroup)">
            <template v-if="inGroup.stereo">
              <button
                class="route-ch-btn"
                :class="{ active: isConnected(inGroup.left.port, routeTarget.left.port) }"
                @click="toggleConnection(inGroup.left.port, routeTarget.left.port)"
              >
                <span
                  class="route-ch-tag"
                  :style="`background:${typeTag(inGroup.left.label).color}`"
                  >{{ typeTag(inGroup.left.label).text }}</span
                >
                <span class="route-ch-name">{{ groupLabel(inGroup) }} L</span>
              </button>
              <button
                class="route-ch-btn"
                :class="{
                  active: isConnected(inGroup.right.port, routeTarget.left.port),
                }"
                @click="toggleConnection(inGroup.right.port, routeTarget.left.port)"
              >
                <span
                  class="route-ch-tag"
                  :style="`background:${typeTag(inGroup.right.label).color}`"
                  >{{ typeTag(inGroup.right.label).text }}</span
                >
                <span class="route-ch-name">{{ groupLabel(inGroup) }} R</span>
              </button>
            </template>
            <template v-else>
              <button
                class="route-ch-btn"
                :class="{ active: isConnected(inGroup.ch.port, routeTarget.left.port) }"
                @click="toggleConnection(inGroup.ch.port, routeTarget.left.port)"
              >
                <span
                  class="route-ch-tag"
                  :style="`background:${typeTag(inGroup.ch.label).color}`"
                  >{{ typeTag(inGroup.ch.label).text }}</span
                >
                <span class="route-ch-name">{{ groupLabel(inGroup) }}</span>
              </button>
            </template>
          </template>
        </q-card-section>
        <q-separator />
        <q-card-section class="route-dialog-section-label">
          {{ groupLabel(routeTarget) }} R
        </q-card-section>
        <q-card-section class="route-dialog-body">
          <template v-for="inGroup in inputGroups" :key="'R-' + groupKey(inGroup)">
            <template v-if="inGroup.stereo">
              <button
                class="route-ch-btn"
                :class="{
                  active: isConnected(inGroup.left.port, routeTarget.right.port),
                }"
                @click="toggleConnection(inGroup.left.port, routeTarget.right.port)"
              >
                <span
                  class="route-ch-tag"
                  :style="`background:${typeTag(inGroup.left.label).color}`"
                  >{{ typeTag(inGroup.left.label).text }}</span
                >
                <span class="route-ch-name">{{ groupLabel(inGroup) }} L</span>
              </button>
              <button
                class="route-ch-btn"
                :class="{
                  active: isConnected(inGroup.right.port, routeTarget.right.port),
                }"
                @click="toggleConnection(inGroup.right.port, routeTarget.right.port)"
              >
                <span
                  class="route-ch-tag"
                  :style="`background:${typeTag(inGroup.right.label).color}`"
                  >{{ typeTag(inGroup.right.label).text }}</span
                >
                <span class="route-ch-name">{{ groupLabel(inGroup) }} R</span>
              </button>
            </template>
            <template v-else>
              <button
                class="route-ch-btn"
                :class="{ active: isConnected(inGroup.ch.port, routeTarget.right.port) }"
                @click="toggleConnection(inGroup.ch.port, routeTarget.right.port)"
              >
                <span
                  class="route-ch-tag"
                  :style="`background:${typeTag(inGroup.ch.label).color}`"
                  >{{ typeTag(inGroup.ch.label).text }}</span
                >
                <span class="route-ch-name">{{ groupLabel(inGroup) }}</span>
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
                :style="`background:${typeTag(inGroup.left.label).color}`"
                >{{ typeTag(inGroup.left.label).text }}</span
              >
              <span class="route-ch-name">{{ groupLabel(inGroup) }} L</span>
            </button>
            <button
              class="route-ch-btn"
              :class="{ active: routeTarget && isInConnected(inGroup.right, routeTarget) }"
              @click="routeTarget && toggleForGroup(inGroup.right, routeTarget)"
            >
              <span
                class="route-ch-tag"
                :style="`background:${typeTag(inGroup.right.label).color}`"
                >{{ typeTag(inGroup.right.label).text }}</span
              >
              <span class="route-ch-name">{{ groupLabel(inGroup) }} R</span>
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
                :style="`background:${typeTag(inGroup.ch.label).color}`"
                >{{ typeTag(inGroup.ch.label).text }}</span
              >
              <span class="route-ch-name">{{ groupLabel(inGroup) }}</span>
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
  min-width: 520px;
  max-width: 720px;
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
  grid-template-columns: repeat(4, 1fr);
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
