<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import Select from 'primevue/select'
import SlotList from '@/components/SlotList.vue'
import { useSlots } from '@/composables/useSlots'
import { dateKey, dateLabel } from '@/time'

const { slots, timezone, isLoading, error, load } = useSlots()
load()

// Даты для фильтра — из самих слотов, в поясе расписания. Слоты приходят по порядку.
const dates = computed(() => {
  const options: { value: string; label: string }[] = []
  for (const slot of slots.value) {
    const value = dateKey(slot.starts_at, timezone.value)
    if (options[options.length - 1]?.value !== value) {
      options.push({ value, label: dateLabel(slot.starts_at, timezone.value) })
    }
  }
  return options
})

// По умолчанию — первая дата (сегодня по серверу); выбор сохраняется, пока такая дата есть
const selectedDate = ref<string | null>(null)
watch(dates, (options) => {
  if (!options.some((option) => option.value === selectedDate.value)) {
    selectedDate.value = options[0]?.value ?? null
  }
})

const visibleSlots = computed(() =>
  slots.value.filter((slot) => dateKey(slot.starts_at, timezone.value) === selectedDate.value),
)
</script>

<template>
  <main class="page">
    <h1 class="page__title">Бронирование переговорной</h1>
    <p v-if="timezone" class="page__hint">Часовой пояс расписания: {{ timezone }}</p>

    <ProgressSpinner
      v-if="isLoading && !slots.length && !error"
      class="page__loader"
      aria-label="Загрузка расписания"
    />

    <Message v-if="error" severity="error" class="page__message">
      <div class="page__error">
        {{ error }}
        <Button label="Повторить" size="small" :loading="isLoading" @click="load" />
      </div>
    </Message>
    <Message v-else-if="!isLoading && !slots.length" severity="info" class="page__message">
      Нет слотов для бронирования
    </Message>

    <template v-if="slots.length">
      <Select
        v-model="selectedDate"
        :options="dates"
        option-label="label"
        option-value="value"
        aria-label="Дата"
        class="page__date"
      />
      <SlotList :slots="visibleSlots" :timezone="timezone" @reload="load" />
    </template>
  </main>
</template>

<style>
body {
  margin: 0;
  font-family: system-ui, sans-serif;
  color: var(--p-text-color);
  background: var(--p-content-background);
}
</style>

<style scoped>
.page {
  max-width: 640px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
}

.page__title {
  margin: 0 0 0.25rem;
  font-size: 1.5rem;
}

.page__hint {
  margin: 0 0 1rem;
  color: var(--p-text-muted-color);
}

.page__loader {
  display: block;
  margin: 2rem auto;
}

.page__message {
  margin-bottom: 1rem;
}

.page__error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.page__date {
  width: 100%;
  margin-bottom: 0.5rem;
}
</style>
