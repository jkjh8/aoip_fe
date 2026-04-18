import { computed, nextTick, ref, watch } from 'vue'
import { useAoipStore } from 'src/stores/aoip'
import { useChannelControl, gainToDb, dbToGain } from './useChannelControl'

export function useChannelPanel(channelType) {
  const aoipState = useAoipStore()
  const { editingId, editingVal, toDb, setGain, toggleMute } = useChannelControl(channelType)

  const channels = computed(() =>
    channelType === 'input' ? aoipState.filteredInputs : aoipState.filteredOutputs,
  )

  const inputRefs = ref({})
  const dragging = ref({})

  const eqOpen = ref(false)
  const eqChannel = ref(null)
  const eqChannelRight = ref(null)

  function openEq(group) {
    eqChannel.value = group.stereo ? group.left : group.ch
    eqChannelRight.value = group.stereo ? group.right : null
    eqOpen.value = true
  }

  function hasDsp(group) {
    const ch = group.stereo ? group.left : group.ch
    return ch?.dsp != null && ch?.bypassDsp !== true
  }

  function isEqActive(group) {
    const ch = group.stereo ? group.left : group.ch
    const dsp = ch?.dsp
    return !!(dsp?.hpf?.enabled || dsp?.eq?.some((b) => b.enabled))
  }

  const channelGroups = computed(() => {
    const chs = channels.value
    const groups = []
    let i = 0
    while (i < chs.length) {
      const ch = chs[i]
      if (ch.label.toLowerCase().includes('analog')) {
        groups.push({ stereo: false, ch })
        i++
      } else {
        const next = chs[i + 1]
        if (next && !next.label.toLowerCase().includes('analog')) {
          groups.push({ stereo: true, left: ch, right: next })
          i += 2
        } else {
          groups.push({ stereo: false, ch })
          i++
        }
      }
    }
    return groups
  })

  function typeTag(label) {
    const l = label.toLowerCase()
    if (l.includes('analog')) return { text: 'ANA', color: '#1976d2' }
    if (l.includes('aes67')) return { text: 'AES', color: '#7b1fa2' }
    if (l.includes('usb')) return { text: 'USB', color: '#388e3c' }
    return { text: label.substring(0, 3).toUpperCase(), color: '#546e7a' }
  }

  function groupTag(group) {
    return typeTag(group.stereo ? group.left.label : group.ch.label)
  }

  function stereoLabel(left) {
    return left.label.replace(/\s*(CH\d+|[LR]|\d+)$/i, '').trim()
  }

  function isMuted(group) {
    return group.stereo ? group.left.muted && group.right.muted : group.ch.muted
  }

  function doToggleMute(group) {
    if (group.stereo) {
      const muted = isMuted(group)
      toggleMute(group.left.id, muted)
      toggleMute(group.right.id, muted)
    } else {
      toggleMute(group.ch.id, group.ch.muted)
    }
  }

  function groupGain(group) {
    return group.stereo ? group.left.gain : group.ch.gain
  }

  function groupKey(group) {
    return group.stereo ? group.left.id : group.ch.id
  }

  function sliderVal(group) {
    return dragging.value[groupKey(group)] ?? gainToDb(groupGain(group))
  }

  function onSliderInput(group, val) {
    dragging.value[groupKey(group)] = Number(val)
  }

  function thumbLeft(val) {
    const pct = ((Number(val) + 60) / 72) * 100
    return `calc(${pct.toFixed(2)}% - ${(pct * 0.14).toFixed(1)}px + 7px)`
  }

  function fmtSlider(val) {
    const v = Number(val)
    if (v <= -60) return '-inf'
    return (v >= 0 ? '+' : '') + v.toFixed(1) + ' dB'
  }

  function onSliderChange(group, val) {
    const gain = dbToGain(Number(val))
    if (group.stereo) {
      setGain(group.left.id, gain)
      setGain(group.right.id, gain)
    } else {
      setGain(group.ch.id, gain)
    }
  }

  async function onDbClick(group) {
    const id = groupKey(group)
    editingId.value = id
    editingVal.value = gainToDb(groupGain(group)).toFixed(1)
    await nextTick()
    inputRefs.value[id]?.focus()
    inputRefs.value[id]?.select()
  }

  function commitEdit(group) {
    const db = parseFloat(editingVal.value)
    if (!isNaN(db)) {
      const gain = dbToGain(Math.max(-60, Math.min(12, db)))
      if (group.stereo) {
        setGain(group.left.id, gain)
        setGain(group.right.id, gain)
      } else {
        setGain(group.ch.id, gain)
      }
    }
    editingId.value = null
    editingVal.value = ''
  }

  function onEditKeydown(e, group) {
    if (e.key === 'Enter') commitEdit(group)
    if (e.key === 'Escape') {
      editingId.value = null
      editingVal.value = ''
    }
  }

  watch(
    () => channels.value.map((c) => c.gain),
    (newGains, oldGains) => {
      if (!oldGains) return
      channels.value.forEach((ch, i) => {
        if (newGains[i] !== oldGains[i]) delete dragging.value[ch.id]
      })
    },
  )

  return {
    channels,
    channelGroups,
    inputRefs,
    dragging,
    eqOpen,
    eqChannel,
    eqChannelRight,
    openEq,
    hasDsp,
    isEqActive,
    editingId,
    editingVal,
    toDb,
    typeTag,
    groupTag,
    stereoLabel,
    isMuted,
    doToggleMute,
    groupGain,
    groupKey,
    sliderVal,
    onSliderInput,
    thumbLeft,
    fmtSlider,
    onSliderChange,
    onDbClick,
    commitEdit,
    onEditKeydown,
  }
}
