import { defineStore } from 'pinia'
import { socket } from 'src/boot/socket'
import { api } from 'src/boot/axios'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    // USB audio device
    usbEnabled: false,
    usbLoading: false,

    // Network
    network: { mode: 'static', ip: '', subnet: '', gateway: '', dns: '', mac: '' },
    networkLoading: false,
    networkSaving: false,

    // System
    rebooting: false,
  }),

  actions: {
    // ── USB ──────────────────────────────────────────────────
    async fetchUsb() {
      try {
        const { data } = await api.get('/system/usb')
        if (data?.enabled !== undefined) this.usbEnabled = data.enabled
      } catch (e) {
        console.error('[USB] fetch failed:', e.message)
      }
    },

    async setUsb(enabled) {
      this.usbLoading = true
      try {
        if (socket.connected) {
          return await new Promise((resolve) => {
            socket.emit('usb:set', { enabled }, (res) => {
              if (res?.ok) this.usbEnabled = res.enabled
              resolve(res)
            })
          })
        } else {
          const { data } = await api.post('/system/usb', { enabled })
          if (data?.ok) this.usbEnabled = data.enabled
          return data
        }
      } catch (e) {
        return { ok: false, error: e.message }
      } finally {
        this.usbLoading = false
      }
    },

    // ── Network (REST only) ───────────────────────────────────
    async fetchNetwork(iface = 'eth0') {
      this.networkLoading = true
      try {
        const { data } = await api.get('/system/network', { params: { iface } })
        Object.assign(this.network, data)
      } catch (e) {
        console.error('[network] fetch failed:', e.message)
      } finally {
        this.networkLoading = false
      }
    },

    async saveNetwork(payload) {
      this.networkSaving = true
      try {
        const { data } = await api.post('/system/network', payload)
        if (data?.ok) Object.assign(this.network, payload)
        return data
      } catch (e) {
        return { ok: false, error: e.message }
      } finally {
        this.networkSaving = false
      }
    },

    // ── System (REST only) ────────────────────────────────────
    async reboot() {
      this.rebooting = true
      try {
        await api.post('/system/reboot')
      } catch (e) {
        console.error('[reboot] failed:', e.message)
        this.rebooting = false
      }
    },
  },
})
