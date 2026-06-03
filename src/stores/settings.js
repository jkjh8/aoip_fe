import { defineStore } from 'pinia'
import { socket } from 'src/boot/socket'
import { api } from 'src/boot/axios'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    // Network
    network: { mode: 'static', ip: '', subnet: '', gateway: '', dns: '', mac: '' },
    networkLoading: false,
    networkSaving: false,

    // Serial
    serial: {
      enabled: false,
      device: '/dev/ttyAMA0',
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      tcpPort: 4001,
    },
    serialLoading: false,
    serialSaving: false,

    // System
    rebooting: false,

    // Log
    log: { enabled: false, debug: false },
    logLoading: false,
    logSaving: false,
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

    // ── Serial (HTTP) ─────────────────────────────────────────
    async fetchSerial() {
      this.serialLoading = true
      try {
        const { data } = await api.get('/serial/config')
        Object.assign(this.serial, data)
      } catch (e) {
        console.error('[serial] fetch failed:', e)
      } finally {
        this.serialLoading = false
      }
    },

    async saveSerial(payload) {
      this.serialSaving = true
      try {
        await api.post('/serial/config', payload)
        Object.assign(this.serial, payload)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: e?.response?.data?.error ?? 'Failed to save' }
      } finally {
        this.serialSaving = false
      }
    },

    // ── Log (HTTP) ────────────────────────────────────────────
    async fetchLog() {
      this.logLoading = true
      try {
        const { data } = await api.get('/system/log')
        if (data && typeof data === 'object') {
          if (typeof data.enabled === 'boolean') this.log.enabled = data.enabled
          if (typeof data.debug === 'boolean') this.log.debug = data.debug
        }
      } catch (e) {
        console.error('[log] fetch failed:', e)
      } finally {
        this.logLoading = false
      }
    },

    async saveLog(payload) {
      this.logSaving = true
      try {
        const { data } = await api.post('/system/log', payload)
        if (data && typeof data === 'object') {
          if (typeof data.enabled === 'boolean') this.log.enabled = data.enabled
          if (typeof data.debug === 'boolean') this.log.debug = data.debug
        } else {
          Object.assign(this.log, payload)
        }
        return { ok: true }
      } catch (e) {
        return { ok: false, error: e?.response?.data?.error ?? 'Failed to save' }
      } finally {
        this.logSaving = false
      }
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
