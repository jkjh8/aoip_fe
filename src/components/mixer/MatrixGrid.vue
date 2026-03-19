<script setup>
import { socket, aoipState } from 'src/boot/socket'
import { computed } from 'vue'

const inputs = computed(() => aoipState.channels.inputs)
const outputs = computed(() => aoipState.channels.outputs)

function isConnected(input, output) {
  const entry = aoipState.jack.connections.find((c) => c.port === input.jackPort)
  return entry ? entry.connections.includes(output.jackPort) : false
}

function toggle(input, output) {
  if (isConnected(input, output)) {
    socket.emit('jack:disconnect', { src: input.jackPort, dst: output.jackPort })
  } else {
    socket.emit('jack:connect', { src: input.jackPort, dst: output.jackPort })
  }
}
</script>

<template>
  <div class="matrix-panel">
    <div class="matrix-scroll">
      <div
        v-if="inputs.length && outputs.length"
        class="matrix-grid"
        :style="`--incols:${inputs.length}`"
      >
        <div class="m-corner">
          IN &rarr;<br /><span style="padding-left: 10px">&#8595; OUT</span>
        </div>

        <div v-for="inp in inputs" :key="'ch-' + inp.id" class="m-col-hdr">
          <span class="m-rot">{{ inp.label }}</span>
        </div>

        <template v-for="out in outputs" :key="'row-' + out.id">
          <div class="m-row-hdr">{{ out.label }}</div>
          <div
            v-for="inp in inputs"
            :key="inp.id + '-' + out.id"
            class="m-cell"
            :class="{ active: isConnected(inp, out) }"
            @click="toggle(inp, out)"
          />
        </template>
      </div>
      <div v-else class="text-grey q-pa-md text-caption">JACK 연결 대기 중...</div>
    </div>
  </div>
</template>

<style scoped>
.matrix-panel {
  flex: 1;
  min-width: 0;
  max-width: 30%;
  display: flex;
  flex-direction: column;
}

.panel-title {
  background: #37474f;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  padding: 7px 12px;
}

.matrix-scroll {
  flex: 1;
  overflow: auto;
  padding: 12px;
}

.matrix-grid {
  display: grid;
  grid-template-columns: 90px repeat(var(--incols), 32px);
  gap: 2px;
  width: fit-content;
}

.m-corner {
  height: 70px;
  display: flex;
  align-items: flex-end;
  padding-bottom: 4px;
  font-size: 8px;
  color: #90a4ae;
  line-height: 1.6;
}

.m-col-hdr {
  width: 32px;
  height: 70px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 4px;
}

.m-rot {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: 9px;
  font-weight: 700;
  color: #37474f;
  white-space: nowrap;
  overflow: hidden;
  max-height: 65px;
}

.m-row-hdr {
  height: 30px;
  display: flex;
  align-items: center;
  font-size: 9px;
  font-weight: 700;
  color: #37474f;
  padding-right: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.m-cell {
  width: 32px;
  height: 30px;
  border-radius: 0;
  background: #cfd8dc;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.1s;
  user-select: none;
}
.m-cell:hover {
  background: #b0bec5;
}
.m-cell.active {
  background: #1565c0;
}
.m-cell.active:hover {
  background: #0d47a1;
}


.body--dark .matrix-panel {
  background: #16213e;
}
.body--dark .m-cell {
  background: #2a3f5f;
}
.body--dark .m-cell:hover {
  background: #344f75;
}
.body--dark .m-rot,
.body--dark .m-row-hdr {
  color: #90a4ae;
}
</style>
