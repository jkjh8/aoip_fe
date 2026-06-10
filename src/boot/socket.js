import { defineBoot } from '#q-app/wrappers'
import { io } from 'socket.io-client'
import { useAoipStore } from 'src/stores/aoip'
import { useSettingsStore } from 'src/stores/settings'

const serverUrl = process.env.DEV
  ? 'http://192.168.10.103:3000'
  : `${window.location.protocol}//${window.location.hostname}:3000`

export const socket = io(serverUrl, {
  autoConnect: true,
  transports: ['websocket'],
  reconnectionDelay: 2000,
  reconnectionDelayMax: 10000,
  timeout: 20000,
})


function mergeDsp(newChannels, store) {
  for (const ch of newChannels.inputs ?? []) {
    const existing = store.channels.inputs.find((c) => c.id === ch.id)
    if (existing?.dsp != null) ch.dsp = existing.dsp
  }
  for (const ch of newChannels.outputs ?? []) {
    const existing = store.channels.outputs.find((c) => c.id === ch.id)
    if (existing?.dsp != null) ch.dsp = existing.dsp
  }
}

export default defineBoot(({ app, pinia }) => {
  app.config.globalProperties.$socket = socket

  const store = useAoipStore(pinia)
  const settingsStore = useSettingsStore(pinia)

  socket.on('connect', () => {
    store.connected = true
    settingsStore.fetchNetwork()
    socket.emit('dsp:mode:get', (res) => {
      if (res?.ok && res.mode) store.dspMode = res.mode
    })

  })
  socket.on('disconnect', () => {
    store.connected = false
  })
  socket.on('status', (data) => {
    if (data.engine) store.engine = data.engine
    if (data.aes67) store.aes67 = data.aes67
    store.bridges = data.bridges
    store.streams = data.streams
    mergeDsp(data.channels, store)
    store.channels = data.channels
    if (data.connections) store.connections = data.connections
    if (data.rxStats) store.rxStats = data.rxStats
  })
  socket.on('engine:status', (data) => {
    store.engine = data
  })
  socket.on('bridges', (data) => {
    store.bridges = data
  })
  socket.on('streams', (data) => {
    store.streams = data
  })
  socket.on('aes67:sources', (data) => {
    store.aes67Sources = Array.isArray(data) ? data : (data?.sources ?? [])
  })
  socket.on('aes67:sinks', (data) => {
    store.aes67Sinks = Array.isArray(data) ? data : (data?.sinks ?? [])
  })
  socket.on('aes67:ptp:status', (data) => {
    store.aes67PtpStatus = data
  })
  socket.on('rx:stats', (data) => {
    store.rxStats = data
  })
  socket.on('system:network', (data) => {
    if (data) Object.assign(settingsStore.network, data)
  })
  socket.on('dsp:mode', (mode) => {
    if (mode && (mode.input || mode.output)) store.dspMode = mode
  })
  socket.on('channels', (data) => {
    mergeDsp(data, store)
    store.channels = data
  })
  socket.on('dsp:changed', ({ type, id, key, params }) => {
    console.log('dsp:changed', { type, id, key, params })
    const list = type === 'input' ? store.channels.inputs : store.channels.outputs
    const ch = list.find((c) => c.id === id)
    if (!ch) return
    if (!ch.dsp) ch.dsp = {}
    if (key === 'eq' && params?.band != null) {
      if (!Array.isArray(ch.dsp.eq)) ch.dsp.eq = []
      const idx = params.band - 1
      if (!ch.dsp.eq[idx]) ch.dsp.eq[idx] = {}
      Object.assign(ch.dsp.eq[idx], params)
    } else {
      ch.dsp[key] = params
    }
  })
  socket.on('levels', (buf) => {
    const v = new DataView(buf instanceof ArrayBuffer ? buf : buf.buffer)
    const n = v.getUint8(0), m = v.getUint8(1)
    let o = 2
    for (let i = 0; i < n; i++) {
      const id = v.getUint8(o++)
      const dB = v.getUint8(o++) / 2 - 120
      const ch = store.channels.inputs.find((c) => c.id === id)
      if (ch) ch.level = dB
    }
    for (let i = 0; i < m; i++) {
      const id = v.getUint8(o++)
      const dB = v.getUint8(o++) / 2 - 120
      const ch = store.channels.outputs.find((c) => c.id === id)
      if (ch) ch.level = dB
    }
  })
  socket.on('gr', (buf) => {
    const v = new DataView(buf instanceof ArrayBuffer ? buf : buf.buffer)
    const n = v.getUint8(0), m = v.getUint8(1)
    let o = 2
    const inputs = [], outputs = []
    for (let i = 0; i < n; i++) inputs.push({
      ch: v.getUint8(o++), gate: v.getUint8(o++) / 2, comp: v.getUint8(o++) / 2,
    })
    for (let i = 0; i < m; i++) outputs.push({
      ch: v.getUint8(o++), gate: v.getUint8(o++) / 2, comp: v.getUint8(o++) / 2, lim: v.getUint8(o++) / 2,
    })
    store.gr = { inputs, outputs }
  })
})
