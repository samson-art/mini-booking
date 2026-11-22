<script setup lang="ts">
import { ref } from 'vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { cancelBooking, type Slot } from '@/api/bookings'
import { ApiError } from '@/api/client'
import { slotLabel, slotRange } from '@/time'

const props = defineProps<{ slots: Slot[]; timezone: string }>()

const emit = defineEmits<{
  book: [slot: Slot]
  // список устарел (после отмены) — родитель перезагружает
  reload: []
}>()

const confirm = useConfirm()
const toast = useToast()

// Слот, чья отмена сейчас идёт: его кнопка в loading
const cancellingId = ref<number | null>(null)

function cancel(slot: Slot): void {
  confirm.require({
    header: 'Отмена бронирования',
    message: `Отменить бронирование: ${slotLabel(slot, props.timezone)}?`,
    acceptLabel: 'Да, отменить',
    rejectLabel: 'Нет',
    accept: async () => {
      cancellingId.value = slot.id
      try {
        await cancelBooking(slot.booking_id!)
        toast.add({ severity: 'success', summary: 'Бронирование отменено', life: 3000 })
        emit('reload')
      } catch (error) {
        if (!(error instanceof ApiError)) throw error

        if (error.status === 404) {
          // Брони уже нет (отменили в другой вкладке) — цель достигнута
          toast.add({ severity: 'info', summary: 'Бронирование уже отменено', life: 3000 })
          emit('reload')
        } else if (error.status === 409) {
          // Слот успел начаться, пока страница была открыта
          toast.add({
            severity: 'warn',
            summary: 'Не удалось отменить',
            detail: error.message,
            life: 5000,
          })
          emit('reload')
        } else {
          const detail =
            error.status === 429
              ? error.message
              : 'Не удалось отменить бронирование. Попробуйте ещё раз.'
          toast.add({ severity: 'error', summary: 'Ошибка', detail, life: 5000 })
        }
      } finally {
        cancellingId.value = null
      }
    },
  })
}

const statuses = {
  available: { label: 'Свободно', severity: 'success' },
  booked: { label: 'Занято', severity: 'danger' },
  past: { label: 'Прошёл', severity: 'secondary' },
} as const
</script>

<template>
  <ul class="slots">
    <li
      v-for="slot in slots"
      :key="slot.id"
      data-testid="slot"
      class="slot"
      :class="{ 'slot--past': slot.status === 'past' }"
    >
      <span class="slot__time">{{ slotRange(slot, timezone) }}</span>
      <Tag :value="statuses[slot.status].label" :severity="statuses[slot.status].severity" />
      <!-- У прошедшего слота действий нет, даже если на нём есть бронь -->
      <Button
        v-if="slot.status === 'available'"
        class="slot__action"
        label="Забронировать"
        size="small"
        @click="$emit('book', slot)"
      />
      <Button
        v-else-if="slot.status === 'booked'"
        class="slot__action"
        label="Отменить"
        severity="danger"
        outlined
        size="small"
        :loading="cancellingId === slot.id"
        @click="cancel(slot)"
      />
    </li>
  </ul>
</template>

<style scoped>
.slots {
  list-style: none;
  margin: 0;
  padding: 0;
}

/* Время и тег слева, кнопка справа; на узком экране кнопка переносится вниз */
.slot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--p-content-border-color);
}

.slot__time {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.slot__action {
  margin-left: auto;
}

.slot--past {
  opacity: 0.55;
}
</style>
