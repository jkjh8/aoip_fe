import { defineBoot } from '#q-app/wrappers'
import { io } from 'socket.io-client'
import { reactive } from 'vue'

export const socket = io('http://192.168.10.103:3000', {
  autoConnect: true,
  reconnectionDelay: 2000,
})

export const aoipState = reactive({
  connected: false,
  jack: { running: false, ports: [], connections: [] },
  bridges: {},
  streams: {},
  channels: { inputs: [], outputs: [] },
})

socket.on('connect', () => { aoipState.connected = true })
socket.on('disconnect', () => { aoipState.connected = false })
socket.on('status', (data) => {
  aoipState.jack = data.jack
  aoipState.bridges = data.bridges
  aoipState.streams = data.streams
  aoipState.channels = data.channels
})
socket.on('levels', (data) => {
  for (const { id, level } of (data.inputs ?? [])) {
    const ch = aoipState.channels.inputs.find(c => c.id === id)
    if (ch) ch.level = level
  }
  for (const { id, level } of (data.outputs ?? [])) {
    const ch = aoipState.channels.outputs.find(c => c.id === id)
    if (ch) ch.level = level
  }
})

export default defineBoot(({ app }) => {
  app.config.globalProperties.$socket = socket
  app.config.globalProperties.$aoip = aoipState
})
