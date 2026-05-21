<script setup>
import { computed } from 'vue'
import { socket } from 'src/boot/socket'
import { useAoipStore } from 'src/stores/aoip'

defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue'])

const aoipState = useAoipStore()

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

// 출력 컬럼 헤더용 짧은 라벨 (마지막 단어만)
function shortLabel(label) {
  const parts = label.trim().split(/\s+/)
  return parts[parts.length - 1]
}
</script>

<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    persistent
  >
    <q-card class="mx-card">
      <!-- 헤더 -->
      <q-card-section class="mx-header">
        <span class="mx-title">Crosspoint Matrix</span>
        <q-btn flat dense round icon="close" size="sm" @click="emit('update:modelValue', false)" />
      </q-card-section>
      <q-separator />

      <!-- 매트릭스 -->
      <div class="mx-scroll">
        <table class="mx-table">
          <thead>
            <tr>
              <!-- 코너 셀: IN/OUT 축 표시 -->
              <th class="mx-corner">
                <div class="mx-corner-inner">
                  <span class="mx-axis mx-axis--out">OUTPUT →</span>
                  <div class="mx-corner-line" />
                  <span class="mx-axis mx-axis--in">↓ INPUT</span>
                </div>
              </th>
              <!-- 출력 컬럼 헤더 -->
              <th v-for="out in outputs" :key="out.id" class="mx-col-head">
                <div class="mx-col-inner">
                  <span class="mx-col-tag" :style="`background:${typeColor(out.label)}`">
                    {{ typeTag(out.label) }}
                  </span>
                  <span class="mx-col-label">{{ shortLabel(out.label) }}</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="inp in inputs" :key="inp.id">
              <!-- 입력 행 헤더 -->
              <td class="mx-row-head">
                <span class="mx-col-tag" :style="`background:${typeColor(inp.label)}`">
                  {{ typeTag(inp.label) }}
                </span>
                <span class="mx-col-label">{{ shortLabel(inp.label) }}</span>
              </td>
              <!-- 크로스포인트 셀 -->
              <td
                v-for="out in outputs"
                :key="out.id"
                class="mx-cell"
                :class="{ 'mx-cell--on': isConnected(inp.port, out.port) }"
                @click="toggle(inp.port, out.port)"
              />
            </tr>
          </tbody>
        </table>
      </div>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.mx-card {
  width: fit-content;
  min-width: 300px;
  max-width: 96vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.mx-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px 8px;
  flex-shrink: 0;
}
.mx-title {
  font-size: 14px;
  font-weight: 700;
  color: #37474f;
  letter-spacing: 0.3px;
}

/* ── 스크롤 영역 ── */
.mx-scroll {
  overflow: auto;
  flex: 1;
  padding: 10px 14px 14px;
}

/* ── 테이블 ── */
.mx-table {
  border-collapse: separate;
  border-spacing: 3px;
}

/* ── 코너 ── */
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

/* ── 공통 배지 + 라벨 ── */
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

/* ── 출력 컬럼 헤더 ── */
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

/* ── 입력 행 헤더 ── */
.mx-row-head {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 10px 0 0;
  height: 30px;
  white-space: nowrap;
}
/* ── 크로스포인트 셀 ── */
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
  background: #81d4fa;
}
.mx-cell--on:hover {
  background: #4fc3f7;
}
</style>
