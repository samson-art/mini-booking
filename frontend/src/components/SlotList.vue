<script setup lang="ts">
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import type { Slot } from '@/api/bookings'
import { slotRange } from '@/time'

defineProps<{ slots: Slot[]; timezone: string }>()

defineEmits<{
  book: [slot: Slot]
  // список устарел (после отмены) — родитель перезагружает
  reload: []
}>()

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
