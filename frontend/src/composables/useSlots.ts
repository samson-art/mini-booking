import { ref } from 'vue'
import { getSlots, type Slot } from '@/api/bookings'

export function useSlots() {
  const slots = ref<Slot[]>([])
  const timezone = ref('')
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Номер последнего запроса: ответ старого load(), пришедший позже нового, отбрасываем
  let lastRequest = 0

  async function load(): Promise<void> {
    const current = ++lastRequest
    isLoading.value = true
    try {
      const response = await getSlots()
      if (current !== lastRequest) return
      slots.value = response.data
      timezone.value = response.meta.timezone
      error.value = null
    } catch {
      if (current !== lastRequest) return
      // Список не стираем: пользователь видит прежние данные и ошибку над ними
      error.value = 'Не удалось загрузить расписание.'
    } finally {
      if (current === lastRequest) isLoading.value = false
    }
  }

  return { slots, timezone, isLoading, error, load }
}
