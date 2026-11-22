<script setup lang="ts">
import { ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import { createBooking, newIdempotencyKey, type Slot } from '@/api/bookings'
import { ApiError } from '@/api/client'
import { slotLabel } from '@/time'

const props = defineProps<{ bookingSlot: Slot | null; timezone: string }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ reload: [] }>()

const toast = useToast()

const name = ref('')
const email = ref('')
const errors = ref<{ customer_name?: string; customer_email?: string }>({})
const formError = ref<string | null>(null)
const loading = ref(false)
let idempotencyKey = ''

// Каждое открытие — чистая форма и новый ключ; все попытки из этой формы идут с ним
watch(
  visible,
  (isOpen) => {
    if (!isOpen) return
    name.value = ''
    email.value = ''
    errors.value = {}
    formError.value = null
    idempotencyKey = newIdempotencyKey()
  },
  { immediate: true },
)

function validate(): boolean {
  errors.value = {}
  if (!name.value.trim()) errors.value.customer_name = 'Укажите имя.'
  if (!email.value.trim()) errors.value.customer_email = 'Укажите email.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
    errors.value.customer_email = 'Неверный email.'
  }
  return Object.keys(errors.value).length === 0
}

function close(): void {
  visible.value = false
  emit('reload')
}

async function submit(): Promise<void> {
  // Enter в поле во время запроса второго запроса не шлёт
  if (loading.value || !props.bookingSlot || !validate()) return

  loading.value = true
  formError.value = null
  try {
    await createBooking(
      {
        slot_id: props.bookingSlot.id,
        customer_name: name.value.trim(),
        customer_email: email.value.trim(),
      },
      idempotencyKey,
    )
    toast.add({ severity: 'success', summary: 'Слот забронирован', life: 3000 })
    close()
  } catch (error) {
    if (!(error instanceof ApiError)) throw error

    if (error.status === 422) {
      errors.value = {
        customer_name: error.errors.customer_name?.[0],
        customer_email: error.errors.customer_email?.[0],
      }
      // Ошибки слота и ключа не относятся к полям формы — общим сообщением
      formError.value = error.errors.slot_id?.[0] ?? error.errors.idempotency_key?.[0] ?? null
    } else if (error.status === 409) {
      // Слот заняли или он прошёл: форма бесполезна, список устарел
      toast.add({
        severity: 'warn',
        summary: 'Не удалось забронировать',
        detail: error.message,
        life: 5000,
      })
      close()
    } else if (error.status === 429) {
      formError.value = error.message
    } else {
      formError.value = 'Не удалось отправить запрос. Попробуйте ещё раз.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <!-- Пока идёт запрос, форму не закрыть: иначе его ответ попал бы в форму другого слота -->
  <Dialog
    v-model:visible="visible"
    modal
    :header="bookingSlot ? `Бронирование: ${slotLabel(bookingSlot, timezone)}` : ''"
    :closable="!loading"
    :close-on-escape="!loading"
    :style="{ width: '26rem' }"
    :breakpoints="{ '480px': 'calc(100vw - 2rem)' }"
  >
    <form class="form" novalidate @submit.prevent="submit">
      <div class="field">
        <label for="booking-name">Имя</label>
        <InputText
          id="booking-name"
          v-model="name"
          maxlength="255"
          autocomplete="name"
          :invalid="!!errors.customer_name"
          fluid
        />
        <small v-if="errors.customer_name" class="field__error">{{ errors.customer_name }}</small>
      </div>

      <div class="field">
        <label for="booking-email">Email</label>
        <InputText
          id="booking-email"
          v-model="email"
          type="email"
          maxlength="255"
          autocomplete="email"
          :invalid="!!errors.customer_email"
          fluid
        />
        <small v-if="errors.customer_email" class="field__error">{{ errors.customer_email }}</small>
      </div>

      <Message v-if="formError" severity="error" data-testid="form-error">{{ formError }}</Message>

      <Button type="submit" label="Забронировать" :loading="loading" fluid />
    </form>
  </Dialog>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field__error {
  color: var(--p-red-500);
}
</style>
