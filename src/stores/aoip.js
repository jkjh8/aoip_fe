import { defineStore } from 'pinia'
import { useSettingsStore } from './settings'

export const useAoipStore = defineStore('aoip', {
  state: () => ({
    connected: false,
    jack:      { running: false, ports: [], connections: [] },
    bridges:   {},
    streams:   {},
    channels:  { inputs: [], outputs: [] },
    rxStats:   {
      srcIp: null, srcPort: null, codec: null,
      packets: 0, udpBytes: 0, udpPackets: 0,
      drops: 0, bitrateKbps: 0, bufUsedMs: 0,
    },
  }),

  getters: {
    filteredInputs(state) {
      const { usbConnected } = useSettingsStore()
      if (usbConnected) return state.channels.inputs
      return state.channels.inputs.filter((ch) => !ch.label.toLowerCase().includes('usb'))
    },
    filteredOutputs(state) {
      const { usbConnected } = useSettingsStore()
      if (usbConnected) return state.channels.outputs
      return state.channels.outputs.filter((ch) => !ch.label.toLowerCase().includes('usb'))
    },
  },
})
