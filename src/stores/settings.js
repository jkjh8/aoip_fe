import { defineStore } from 'pinia'
import { socket } from 'src/boot/socket'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    // Network
    network: { mode: 'static', ip: '', subnet: '', gateway: '', dns: '', mac: '' },
    networkLoading: false,
    networkSaving: false,

    // System
    rebooting: false,
  }),

  actions: {
    // ── Network (socket) ──────────────────────────────────────
    fetchNetwork(iface = 'eth0') {
      this.networkLoading = true
      socket.emit('system:network:get', { iface }, (res) => {
        this.networkLoading = false
        if (res && !res.error) Object.assign(this.network, res)
        else console.error('[network] fetch failed:', res?.error)
      })
    },

    saveNetwork(payload) {
      this.networkSaving = true
      return new Promise((resolve) => {
        socket.emit('system:network:set', payload, (res) => {
          this.networkSaving = false
          if (res?.ok) Object.assign(this.network, payload)
          resolve(res)
        })
      })
    },

    // ── System (socket) ───────────────────────────────────────
    reboot() {
      this.rebooting = true
      socket.emit('system:reboot', (res) => {
        if (!res?.ok) this.rebooting = false
      })
    },
  },
})
