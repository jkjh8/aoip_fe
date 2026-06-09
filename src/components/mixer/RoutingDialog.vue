<script setup>
import { computed } from 'vue'
import { socket } from 'src/boot/socket'
import { useAoipStore } from 'src/stores/aoip'
import { useChannelPanel } from 'src/composables/useChannelPanel'

const aoipState = useAoipStore()
const { channelSections: inputSections, groupLabel, groupKey, typeTag } = useChannelPanel('input')

const LOCAL_TITLES = new Set(['Analog', 'USB'])
const mergedInputSections = computed(() => {
  const result = []
  let localGroups = []
  for (const sec of inputSections.value) {
    if (LOCAL_TITLES.has(sec.title)) {
      localGroups.push(...sec.groups)
    } else {
      if (localGroups.length) {
        result.push({ title: 'Local', groups: localGroups })
        localGroups = []
      }
      result.push(sec)
    }
  }
  if (localGroups.length) result.push({ title: 'Local', groups: localGroups })
  return result
})

function chColor(ch) {
  return typeTag(ch.label).color
}

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

// 아날로그 스테레오 링크된 첫 번째 채널 (pairFirst)도 스테레오 뷰로 처리
const isLinkedStereo = computed(() => !!(props.routeTarget?.linked && props.routeTarget?.pairFirst))
const effectiveStereo = computed(() => !!(props.routeTarget?.stereo || isLinkedStereo.value))

function leftPort(target) {
  if (!target) return null
  return target.stereo ? target.left.port : (target.ch?.port ?? null)
}

function rightPort(target) {
  if (!target) return null
  return target.stereo ? target.right.port : (target.partner?.port ?? null)
}

const sectionLabelL = computed(() => {
  const t = props.routeTarget
  if (!t) return ''
  if (t.stereo) return groupLabel(t) + ' L'
  if (isLinkedStereo.value) return t.ch.label
  return groupLabel(t)
})

const sectionLabelR = computed(() => {
  const t = props.routeTarget
  if (!t) return ''
  if (t.stereo) return groupLabel(t) + ' R'
  if (isLinkedStereo.value) return t.partner?.label ?? ''
  return groupLabel(t)
})

function isConnected(inputPort, outputPort) {
  const entry = aoipState.connections.find((c) => c.port === inputPort)
  return entry ? entry.connections.includes(outputPort) : false
}

function toggleConnection(inputPort, outputPort) {
  console.log('[USB-dbg] toggleConnection:', inputPort, '->', outputPort)
  if (isConnected(inputPort, outputPort)) {
    socket.emit('route:remove', { src: inputPort, dst: outputPort }, (res) => {
      console.log('[USB-dbg] route:remove res:', res)
    })
  } else {
    socket.emit('route:add', { src: inputPort, dst: outputPort }, (res) => {
      console.log('[USB-dbg] route:add res:', res)
    })
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
      <q-card-section class="row justify-between items-center">
        <span class="item-title">{{ routeTarget ? groupLabel(routeTarget) : '' }}</span>
        <q-btn flat dense round icon="close" size="sm" v-close-popup />
      </q-card-section>
      <q-separator color="grey-6" />
      <!-- 스테레오 출력: L섹션(상단) / R섹션(하단) -->
      <template v-if="routeTarget && effectiveStereo">
        <q-card-section class="text-uppercase text-grey-10">{{ sectionLabelL }}</q-card-section>

        <template v-for="(section, sIdx) in mergedInputSections" :key="'L-sec-' + section.title">
          <q-separator inset v-if="sIdx" />
          <q-card-section
            class="q-py-sm q-px-md"
            style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px"
          >
            <template v-for="inGroup in section.groups" :key="'L-' + groupKey(inGroup)">
              <template v-if="inGroup.stereo">
                <button
                  class="route-ch-btn"
                  :class="{ active: isConnected(inGroup.left.port, leftPort(routeTarget)) }"
                  :style="{ '--ch-color': chColor(inGroup.left) }"
                  @click="toggleConnection(inGroup.left.port, leftPort(routeTarget))"
                >
                  <span class="route-ch-tag" :style="{ background: chColor(inGroup.left) }">{{
                    typeTag(inGroup.left.label).text
                  }}</span>
                  <span class="route-ch-name">{{ groupLabel(inGroup) }} L</span>
                </button>
                <button
                  class="route-ch-btn"
                  :class="{ active: isConnected(inGroup.right.port, leftPort(routeTarget)) }"
                  :style="{ '--ch-color': chColor(inGroup.right) }"
                  @click="toggleConnection(inGroup.right.port, leftPort(routeTarget))"
                >
                  <span class="route-ch-tag" :style="{ background: chColor(inGroup.right) }">{{
                    typeTag(inGroup.right.label).text
                  }}</span>
                  <span class="route-ch-name">{{ groupLabel(inGroup) }} R</span>
                </button>
              </template>
              <template v-else>
                <button
                  class="route-ch-btn"
                  :class="{ active: isConnected(inGroup.ch.port, leftPort(routeTarget)) }"
                  :style="{ '--ch-color': chColor(inGroup.ch) }"
                  @click="toggleConnection(inGroup.ch.port, leftPort(routeTarget))"
                >
                  <span class="route-ch-tag" :style="{ background: chColor(inGroup.ch) }">{{
                    typeTag(inGroup.ch.label).text
                  }}</span>
                  <span class="route-ch-name">{{ groupLabel(inGroup) }}</span>
                </button>
              </template>
            </template>
          </q-card-section>
        </template>
        <q-separator color="grey-6" />
        <q-card-section class="text-uppercase text-grey-10">{{ sectionLabelR }}</q-card-section>
        <template v-for="(section, sIdx) in mergedInputSections" :key="'R-sec-' + section.title">
          <q-separator v-if="sIdx" inset />
          <q-card-section
            class="q-pa-md"
            style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px"
          >
            <template v-for="inGroup in section.groups" :key="'R-' + groupKey(inGroup)">
              <template v-if="inGroup.stereo">
                <button
                  class="route-ch-btn"
                  :class="{ active: isConnected(inGroup.left.port, rightPort(routeTarget)) }"
                  :style="{ '--ch-color': chColor(inGroup.left) }"
                  @click="toggleConnection(inGroup.left.port, rightPort(routeTarget))"
                >
                  <span class="route-ch-tag" :style="{ background: chColor(inGroup.left) }">{{
                    typeTag(inGroup.left.label).text
                  }}</span>
                  <span class="route-ch-name">{{ groupLabel(inGroup) }} L</span>
                </button>
                <button
                  class="route-ch-btn"
                  :class="{ active: isConnected(inGroup.right.port, rightPort(routeTarget)) }"
                  :style="{ '--ch-color': chColor(inGroup.right) }"
                  @click="toggleConnection(inGroup.right.port, rightPort(routeTarget))"
                >
                  <span class="route-ch-tag" :style="{ background: chColor(inGroup.right) }">{{
                    typeTag(inGroup.right.label).text
                  }}</span>
                  <span class="route-ch-name">{{ groupLabel(inGroup) }} R</span>
                </button>
              </template>
              <template v-else>
                <button
                  class="route-ch-btn"
                  :class="{ active: isConnected(inGroup.ch.port, rightPort(routeTarget)) }"
                  :style="{ '--ch-color': chColor(inGroup.ch) }"
                  @click="toggleConnection(inGroup.ch.port, rightPort(routeTarget))"
                >
                  <span class="route-ch-tag" :style="{ background: chColor(inGroup.ch) }">{{
                    typeTag(inGroup.ch.label).text
                  }}</span>
                  <span class="route-ch-name">{{ groupLabel(inGroup) }}</span>
                </button>
              </template>
            </template>
          </q-card-section>
        </template>
      </template>

      <!-- 모노 출력: 단일 섹션 -->
      <template v-else>
        <template v-for="(section, sIdx) in mergedInputSections" :key="'M-sec-' + section.title">
          <q-separator v-if="sIdx" inset />
          <q-card-section
            class="q-pa-md"
            style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px"
          >
            <template v-for="inGroup in section.groups" :key="groupKey(inGroup)">
              <template v-if="inGroup.stereo">
                <button
                  class="route-ch-btn"
                  :class="{ active: routeTarget && isInConnected(inGroup.left, routeTarget) }"
                  :style="{ '--ch-color': chColor(inGroup.left) }"
                  @click="routeTarget && toggleForGroup(inGroup.left, routeTarget)"
                >
                  <span class="route-ch-tag" :style="{ background: chColor(inGroup.left) }">{{
                    typeTag(inGroup.left.label).text
                  }}</span>
                  <span class="route-ch-name">{{ groupLabel(inGroup) }} L</span>
                </button>
                <button
                  class="route-ch-btn"
                  :class="{ active: routeTarget && isInConnected(inGroup.right, routeTarget) }"
                  :style="{ '--ch-color': chColor(inGroup.right) }"
                  @click="routeTarget && toggleForGroup(inGroup.right, routeTarget)"
                >
                  <span class="route-ch-tag" :style="{ background: chColor(inGroup.right) }">{{
                    typeTag(inGroup.right.label).text
                  }}</span>
                  <span class="route-ch-name">{{ groupLabel(inGroup) }} R</span>
                </button>
              </template>
              <template v-else>
                <button
                  class="route-ch-btn"
                  :class="{ active: routeTarget && isInConnected(inGroup.ch, routeTarget) }"
                  :style="{ '--ch-color': chColor(inGroup.ch) }"
                  @click="routeTarget && toggleForGroup(inGroup.ch, routeTarget)"
                >
                  <span class="route-ch-tag" :style="{ background: chColor(inGroup.ch) }">{{
                    typeTag(inGroup.ch.label).text
                  }}</span>
                  <span class="route-ch-name">{{ groupLabel(inGroup) }}</span>
                </button>
              </template>
            </template>
          </q-card-section>
        </template>
      </template>
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
  background: var(--ch-color, #1565c0);
  border-color: var(--ch-color, #1565c0);
}
:deep(.route-section-sep) {
  margin: 4px 0;
  background: #cfd8dc;
  height: 1px;
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
