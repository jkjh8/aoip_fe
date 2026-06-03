import { computed, nextTick, ref, watch } from 'vue'
import { useAoipStore } from 'src/stores/aoip'
import { useChannelControl, gainToDb, dbToGain } from './useChannelControl'
import { socket } from 'src/boot/socket'

export function useChannelPanel(channelType) {
  const aoipState = useAoipStore()
  const { editingId, editingVal, toDb, setGain, toggleMute } = useChannelControl(channelType)

  const channels = computed(() =>
    channelType === 'input' ? aoipState.filteredInputs : aoipState.filteredOutputs,
  )

  const isI2sLinked = computed(() => aoipState.dspMode?.[channelType] === 'stereo')

  function toggleAnalogLink() {
    const next = isI2sLinked.value ? 'mono' : 'stereo'
    socket.emit('dsp:mode:set', { direction: channelType, mode: next }, (res) => {
      if (res?.ok && res.mode) aoipState.dspMode = res.mode
      else if (res && !res.ok) console.warn('[dsp:mode:set] failed:', res.error)
    })
  }

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

  function getChannelType(label) {
    const l = label.toLowerCase()
    if (l.includes('analog')) return 'analog'
    if (l.includes('stream')) return 'stream'
    if (l.includes('aes67')) return 'aes67'
    return 'other'
  }

  const SECTION_META = {
    analog: { title: 'Analog', color: '#1976d2' },
    stream: { title: 'Stream', color: '#2e7d32' },
    aes67:  { title: 'AES67',  color: '#7b1fa2' },
    other:  { title: 'Other',  color: '#546e7a' },
  }

  const channelSections = computed(() => {
    const chs = channels.value
    const typeMap = { analog: [], stream: [], aes67: [], other: [] }
    for (const ch of chs) typeMap[getChannelType(ch.label)].push(ch)

    const sections = []
    for (const type of ['analog', 'stream', 'aes67', 'other']) {
      const typeChs = typeMap[type]
      if (!typeChs.length) continue
      const groups = []
      if (type === 'stream') {
        let i = 0
        while (i < typeChs.length) {
          const ch = typeChs[i]
          const next = typeChs[i + 1]
          if (next) { groups.push({ stereo: true, left: ch, right: next }); i += 2 }
          else       { groups.push({ stereo: false, ch }); i++ }
        }
      } else if (type === 'analog') {
        const linked = isI2sLinked.value
        for (let i = 0; i < typeChs.length; i++) {
          const ch = typeChs[i]
          // Only the first I2S pair (Analog 1 & 2) is link-capable; backend mirrors when stereo.
          if (i === 0 && typeChs[1]) {
            groups.push({ stereo: false, ch, pairId: ch.id, pairFirst: true, linked, partner: typeChs[1] })
          } else if (i === 1 && typeChs[0]) {
            groups.push({ stereo: false, ch, pairId: typeChs[0].id, pairFirst: false, linked, partner: typeChs[0] })
          } else {
            groups.push({ stereo: false, ch })
          }
        }
      } else {
        for (const ch of typeChs) groups.push({ stereo: false, ch })
      }
      sections.push({ ...SECTION_META[type], groups })
    }
    return sections
  })

  const channelGroups = computed(() => channelSections.value.flatMap((s) => s.groups))

  function typeTag(label) {
    const l = label.toLowerCase()
    if (l.includes('analog')) return { text: 'ANA', color: '#1976d2' }
    if (l.includes('aes67')) return { text: 'AES', color: '#7b1fa2' }
    if (l.includes('stream')) return { text: 'STR', color: '#2e7d32' }
    return { text: label.substring(0, 3).toUpperCase(), color: '#546e7a' }
  }

  function groupTag(group) {
    return typeTag(group.stereo ? group.left.label : group.ch.label)
  }

  function stereoLabel(left) {
    return left.label.replace(/\s*(CH\d+|[LR]|\d+)$/i, '').trim()
  }

  function groupLabel(group) {
    if (!group.stereo) return group.ch.label
    const l = group.left.label
    const r = group.right.label
    let i = 0
    while (i < l.length && i < r.length && l[i] === r[i]) i++
    const prefix = l.substring(0, i).trim()
    // If prefix ends with a digit the stream number is preserved; otherwise fall back to left label
    return /\d$/.test(prefix) ? prefix : l
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
      // I2S stereo link mirrors mute on the backend, so a single call is enough.
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
    if (group.linked && group.partner) {
      dragging.value[group.partner.id] = Number(val)
    }
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
    channelSections,
    toggleAnalogLink,
    groupLabel,
    getChannelType,
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
