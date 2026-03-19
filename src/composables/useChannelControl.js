import { ref } from 'vue'
import { socket } from 'src/boot/socket'

export function useChannelControl(type) {
  const editingId = ref(null)
  const editingVal = ref('')

  function toDb(gain) {
    if (gain == null || gain <= 0) return '-inf'
    const db = 20 * Math.log10(gain / 100)
    return (db >= 0 ? '+' : '') + db.toFixed(1) + ' dB'
  }

  function levelPct(level) {
    if (level == null) return 0
    return Math.max(0, Math.min(100, ((level + 60) / 60) * 100))
  }

  function levelColor(level) {
    if (level == null) return '#66bb6a'
    if (level > -6) return '#ef5350'
    if (level > -18) return '#ffa726'
    return '#66bb6a'
  }

  function setGain(id, gain) {
    socket.emit('ch:gain', { type, id, gain })
  }

  function toggleMute(id, muted) {
    socket.emit('ch:mute', { type, id, muted: !muted })
  }

  function startEdit(id, gain) {
    editingId.value = id
    if (gain == null || gain <= 0) {
      editingVal.value = '-60'
    } else {
      const db = 20 * Math.log10(gain / 100)
      editingVal.value = db.toFixed(1)
    }
  }

  function commitEdit(id) {
    const db = parseFloat(editingVal.value)
    if (!isNaN(db)) {
      const clamped = Math.max(-60, Math.min(6, db))
      const gain = clamped <= -60 ? 0 : Math.round(Math.max(0, Math.min(150, 100 * Math.pow(10, clamped / 20))))
      setGain(id, gain)
    }
    editingId.value = null
    editingVal.value = ''
  }

  function onEditKeydown(e, id) {
    if (e.key === 'Enter') commitEdit(id)
    if (e.key === 'Escape') {
      editingId.value = null
      editingVal.value = ''
    }
  }

  return {
    editingId, editingVal,
    toDb, levelPct, levelColor,
    setGain, toggleMute,
    startEdit, commitEdit, onEditKeydown,
  }
}
