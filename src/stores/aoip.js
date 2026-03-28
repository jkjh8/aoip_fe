import { defineStore } from 'pinia'

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
})
