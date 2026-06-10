import { defineStore } from 'pinia'

export const useAoipStore = defineStore('aoip', {
  state: () => ({
    connected: false,
    engine:      { running: false, ready: false, uptime: null },
    aes67:       { running: false, ready: false, url: '' },
    aes67Sources: [],
    aes67Sinks:   [],
    aes67PtpStatus: null,
    bridges:     {},
    streams:     {},
    connections: [],
    channels:    { inputs: [], outputs: [] },
    gr:          { inputs: [], outputs: [] },
    dspMode:     { input: 'mono', output: 'mono' },
    rxStats:   {
      srcIp: null, srcPort: null, codec: null,
      packets: 0, udpBytes: 0, udpPackets: 0,
      drops: 0, bitrateKbps: 0, bufUsedMs: 0,
    },
  }),

  getters: {
    filteredInputs:  (state) => state.channels.inputs,
    filteredOutputs: (state) => state.channels.outputs,
  },
})
