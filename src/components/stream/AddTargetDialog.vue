<script setup>
import { ref } from 'vue'
import { useDialogPluginComponent } from 'quasar'

defineEmits([...useDialogPluginComponent.emits])

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

const host  = ref('')
const port  = ref('')
const error = ref('')

function onOk() {
  const h = host.value.trim()
  const p = Number(port.value)
  if (!h || !p) { error.value = 'Host와 Port를 입력하세요'; return }
  onDialogOK({ host: h, port: p })
}
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" persistent>
    <q-card style="min-width: 320px">
      <q-card-section class="row items-center q-pb-sm">
        <q-icon name="wifi_tethering" color="blue-7" size="sm" class="q-mr-sm" />
        <span class="text-subtitle1 text-weight-bold">Add UDP Target</span>
      </q-card-section>

      <q-separator />

      <q-card-section class="q-pt-md">
        <div class="row q-gutter-sm">
          <div class="col">
            <div class="field-label">Host / IP</div>
            <q-input
              v-model="host"
              dense outlined
              placeholder="192.168.0.100"
              autofocus
              class="q-mt-xs"
              @keydown.enter="onOk"
            />
          </div>
          <div style="width: 110px">
            <div class="field-label">Port</div>
            <q-input
              v-model="port"
              dense outlined
              placeholder="5004"
              type="number"
              class="q-mt-xs"
              @keydown.enter="onOk"
            />
          </div>
        </div>
        <p v-if="error" class="add-error q-mt-sm q-mb-none">{{ error }}</p>
      </q-card-section>

      <q-separator />

      <q-card-actions align="right" class="q-pa-sm">
        <q-btn flat label="Cancel" color="grey-7" @click="onDialogCancel" />
        <q-btn
          unelevated label="Add" color="blue-7"
          :disable="!host || !port"
          @click="onOk"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.field-label {
  font-size: 11px;
  font-weight: 700;
  color: #90a4ae;
  letter-spacing: 0.6px;
  text-transform: uppercase;
}
.add-error { font-size: 12px; color: #c62828; font-weight: 600; }
</style>
