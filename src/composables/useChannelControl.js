import { ref } from 'vue'
import { socket } from 'src/boot/socket'

/**
 * 백엔드 gain 값(0~150 정수) → dB 변환
 *   0       → -∞  (-60 표시)
 *   0~100   → -60dB ~ 0dB  (선형)
 *   100~150 → 0dB  ~ +12dB (선형)
 */
export function gainToDb(gain) {
  if (gain == null || gain <= 0) return -60
  if (gain <= 100) return (gain / 100) * 60 - 60
  return ((gain - 100) / 50) * 12
}

/** dB → gain 0~150 정수 */
export function dbToGain(db) {
  if (db <= -60) return 0
  if (db <= 0) return Math.round((db + 60) / 60 * 100)
  return Math.round(Math.min(150, (db / 12) * 50 + 100))
}

export function useChannelControl(type) {
  const editingId = ref(null)
  const editingVal = ref('')

  function toDb(gain) {
    if (gain == null || gain <= 0) return '-inf'
    const db = gainToDb(gain)
    return (db >= 0 ? '+' : '') + db.toFixed(1) + ' dB'
  }

  function levelPct(level) {
    if (level == null) return 0
    return Math.max(0, Math.min(100, ((level + 60) / 60) * 100))
  }

  function levelColor(level) {
    if (level == null) return '#66bb6a'
    if (level > -3) return '#ef5350'
    if (level > -12) return '#ffa726'
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
