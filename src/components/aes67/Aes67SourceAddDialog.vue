<script setup>
import { ref, computed } from 'vue'
import { useDialogPluginComponent } from 'quasar'
import { socket } from 'src/boot/socket'
import { useAoipStore } from 'src/stores/aoip'

defineEmits([...useDialogPluginComponent.emits])
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent()

const aoipState = useAoipStore()
const sources = computed(() => aoipState.aes67Sources)
const nextId = computed(() =>
  sources.value.length ? Math.max(...sources.value.map((s) => s.id)) + 1 : 0,
)

function usedSlots() {
  const used = new Set()
  for (const s of sources.value)
    for (const idx of (s.map ?? [])) used.add(idx)
  return used
}
function chSlotOptions(unit) {
  const used = usedSlots()
  return Array.from({ length: Math.floor(16 / unit) }, (_, i) => {
    const start = i * unit
    const inUse = Array.from({ length: unit }, (_, j) => start + j).some((idx) => used.has(idx))
    return { label: `Ch ${start + 1}–${start + unit}`, value: start, disable: inUse }
  })
}
function firstAvailableSlot(unit) {
  const used = usedSlots()
  for (let i = 0; i < 16; i += unit)
    if (!Array.from({ length: unit }, (_, j) => i + j).some((idx) => used.has(idx))) return i
  return 0
}

const busy = ref(false)
const error = ref('')
const codecOptions = ['L16', 'L24', 'AM824']
const sppOptions = [12, 24, 48, 96, 192]
const chUnitOptions = [{ label: '2ch', value: 2 }, { label: '8ch', value: 8 }]
const form = ref({ name: '', address: '239.69.0.1', codec: 'L24', spp: 48, chUnit: 2, chStart: firstAvailableSlot(2), ttl: 15 })

function confirm() {
  const f = form.value
  if (!f.name.trim()) { error.value = '이름을 입력하세요'; return }
  if (!f.address.trim()) { error.value = '주소를 입력하세요'; return }
  const map = Array.from({ length: f.chUnit }, (_, i) => f.chStart + i)
  const addrConflict = sources.value.find((s) => s.address === f.address.trim())
  if (addrConflict) { error.value = `주소 ${f.address.trim()}는 "${addrConflict.name}"에서 이미 사용 중입니다`; return }
  const mapSet = new Set(map)
  const chConflict = sources.value.find((s) => (s.map ?? []).some((ch) => mapSet.has(ch)))
  if (chConflict) {
    error.value = `채널이 "${chConflict.name}"과 겹칩니다 (${chConflict.map.filter((ch) => mapSet.has(ch)).map((ch) => `Ch ${ch + 1}`).join(', ')})`
    return
  }
  busy.value = true
  error.value = ''
  socket.emit('aes67:source:add', {
    id: nextId.value, enabled: true,
    name: f.name.trim(), io: 'Audio Device',
    address: f.address.trim(), codec: f.codec,
    max_samples_per_packet: f.spp, ttl: f.ttl,
    payload_type: 98, dscp: 34, refclk_ptp_traceable: false, map,
  }, (res) => {
    busy.value = false
    if (res?.ok) onDialogOK()
    else error.value = res?.error ?? 'Failed'
  })
}
</script>

<template>
  <q-dialog ref="dialogRef" persistent @hide="onDialogHide">
    <q-card style="min-width: 400px">
      <q-card-section class="dialog-head">
        <span class="dialog-title">Add AES67 Source (출력)</span>
      </q-card-section>
      <q-separator />
      <q-card-section class="dialog-body">
        <div class="field-group">
          <label class="field-label">이름</label>
          <q-input v-model="form.name" dense outlined placeholder="Source 이름" autofocus />
        </div>
        <div class="field-group">
          <label class="field-label">Multicast Address</label>
          <q-input v-model="form.address" dense outlined placeholder="239.69.x.x" class="font-mono" />
        </div>
        <div class="dlg-row">
          <div class="field-group" style="flex:1">
            <label class="field-label">Codec</label>
            <q-select v-model="form.codec" :options="codecOptions" dense outlined emit-value map-options />
          </div>
          <div class="field-group" style="flex:1">
            <label class="field-label">Samples / Packet</label>
            <q-select v-model="form.spp" :options="sppOptions" dense outlined emit-value map-options />
          </div>
        </div>
        <div class="dlg-row">
          <div class="field-group" style="flex:1">
            <label class="field-label">채널 단위</label>
            <q-select v-model="form.chUnit" :options="chUnitOptions" emit-value map-options dense outlined
              @update:model-value="(val) => { form.chStart = firstAvailableSlot(val) }" />
          </div>
          <div class="field-group" style="flex:2">
            <label class="field-label">채널 슬롯</label>
            <q-select v-model="form.chStart" :options="chSlotOptions(form.chUnit)"
              emit-value map-options dense outlined option-disable="disable" />
          </div>
          <div class="field-group" style="flex:1">
            <label class="field-label">TTL</label>
            <q-input v-model.number="form.ttl" dense outlined type="number" :min="1" />
          </div>
        </div>
        <p v-if="error" class="form-error">{{ error }}</p>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right" class="dialog-actions">
        <q-btn flat label="취소" color="grey-7" v-close-popup />
        <q-btn unelevated label="추가" color="blue-7" :loading="busy" @click="confirm" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.dialog-head { padding: 14px 20px; }
.dialog-title { font-size: 15px; font-weight: 700; color: #37474f; }
.dialog-body { display: flex; flex-direction: column; gap: 14px; padding: 16px 20px; }
.dialog-actions { padding: 8px 16px 12px; }
.dlg-row { display: flex; gap: 10px; align-items: flex-end; }
.field-group { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 11px; font-weight: 700; color: #90a4ae; letter-spacing: 0.5px; text-transform: uppercase; }
.form-error { margin: 0; font-size: 12px; color: #c62828; font-weight: 600; }
.font-mono { font-family: 'Courier New', monospace; }
</style>
