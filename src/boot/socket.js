import { defineBoot } from '#q-app/wrappers'
import { io } from 'socket.io-client'
import { useAoipStore } from 'src/stores/aoip'

export const socket = io('http://192.168.10.103:3000', {
  autoConnect: true,
  reconnectionDelay: 2000,
})

export default defineBoot(({ app, pinia }) => {
  app.config.globalProperties.$socket = socket

  const store = useAoipStore(pinia)

  socket.on('connect', () => {
    store.connected = true
  })
  socket.on('disconnect', () => {
    store.connected = false
  })
  socket.on('status', (data) => {
    store.jack = data.jack
    store.bridges = data.bridges
    store.streams = data.streams
    store.channels = data.channels
    if (data.rxStats) store.rxStats = data.rxStats
  })
  socket.on('rx:stats', (data) => {
    store.rxStats = data
  })
  socket.on('channels', (data) => {
    store.channels = data
  })
  socket.on('levels', (data) => {
    for (const { id, level } of data.inputs ?? []) {
      const ch = store.channels.inputs.find((c) => c.id === id)
      if (ch) ch.level = level
    }
    for (const { id, level } of data.outputs ?? []) {
      const ch = store.channels.outputs.find((c) => c.id === id)
      if (ch) ch.level = level
    }
  })
})
