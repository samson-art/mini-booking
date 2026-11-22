import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Select from 'primevue/select'
import App from '../App.vue'
import SlotList from '@/components/SlotList.vue'
import { getSlots, type Slot, type SlotsResponse } from '@/api/bookings'
import { ApiError } from '@/api/client'

vi.mock('@/api/bookings', () => ({ getSlots: vi.fn<typeof import('@/api/bookings').getSlots>() }))
const getSlotsMock = vi.mocked(getSlots)

function slot(id: number, day: string, hour: number): Slot {
  const h = String(hour).padStart(2, '0')
  const next = String(hour + 1).padStart(2, '0')
  return {
    id,
    starts_at: `${day}T${h}:00:00+03:00`,
    ends_at: `${day}T${next}:00:00+03:00`,
    status: 'available',
    booking_id: null,
  }
}

function response(...slots: Slot[]): SlotsResponse {
  return { data: slots, meta: { timezone: 'Europe/Moscow' } }
}

const twoDays = response(
  slot(1, '2026-11-23', 9),
  slot(2, '2026-11-23', 10),
  slot(3, '2026-11-24', 9),
)

function mountApp() {
  return mount(App, { global: { plugins: [PrimeVue] } })
}

const shownTimes = (wrapper: ReturnType<typeof mountApp>) =>
  wrapper.findAll('[data-testid="slot"]').map((row) => row.text().slice(0, 11))

afterEach(() => getSlotsMock.mockReset())

describe('App', () => {
  it('shows a loader, then an error with a working retry', async () => {
    let fail!: (e: unknown) => void
    getSlotsMock.mockReturnValueOnce(new Promise((_, reject) => (fail = reject)))
    const wrapper = mountApp()

    expect(wrapper.find('[role="progressbar"]').exists()).toBe(true)

    fail(new ApiError(0, 'нет сети'))
    await flushPromises()
    expect(wrapper.text()).toContain('Не удалось загрузить расписание.')

    let succeed!: (r: SlotsResponse) => void
    getSlotsMock.mockReturnValueOnce(new Promise((resolve) => (succeed = resolve)))
    const retry = wrapper.get('button')
    expect(retry.text()).toContain('Повторить')
    await retry.trigger('click')
    expect(retry.attributes('disabled')).toBeDefined() // пока идёт повтор — кнопка заблокирована

    succeed(twoDays)
    await flushPromises()
    expect(wrapper.text()).not.toContain('Не удалось загрузить расписание.')
    expect(shownTimes(wrapper)).toEqual(['09:00–10:00', '10:00–11:00'])
  })

  it('keeps the list and shows the error above it when a reload fails', async () => {
    getSlotsMock.mockResolvedValueOnce(twoDays)
    const wrapper = mountApp()
    await flushPromises()

    getSlotsMock.mockRejectedValueOnce(new ApiError(500, 'ошибка'))
    wrapper.findComponent(SlotList).vm.$emit('reload')
    await flushPromises()

    expect(wrapper.text()).toContain('Не удалось загрузить расписание.')
    expect(shownTimes(wrapper)).toEqual(['09:00–10:00', '10:00–11:00'])
  })

  it('says there are no slots when the schedule is empty', async () => {
    getSlotsMock.mockResolvedValueOnce(response())
    const wrapper = mountApp()
    await flushPromises()

    expect(wrapper.text()).toContain('Нет слотов для бронирования')
    expect(wrapper.findComponent(Select).exists()).toBe(false)
  })

  it('filters by date in the schedule timezone and keeps the choice across reloads', async () => {
    getSlotsMock.mockResolvedValueOnce(twoDays)
    const wrapper = mountApp()
    await flushPromises()

    expect(wrapper.text()).toContain('Europe/Moscow')
    const select = wrapper.findComponent(Select)
    expect(select.props('options')).toEqual([
      { value: '2026-11-23', label: 'пн, 23 ноября' },
      { value: '2026-11-24', label: 'вт, 24 ноября' },
    ])
    expect(select.props('modelValue')).toBe('2026-11-23')
    expect(shownTimes(wrapper)).toEqual(['09:00–10:00', '10:00–11:00'])

    select.vm.$emit('update:modelValue', '2026-11-24')
    await flushPromises()
    expect(shownTimes(wrapper)).toEqual(['09:00–10:00'])
    expect(wrapper.find('[data-testid="slot"]').text()).toContain('09:00')

    // перезагрузка: выбранная дата есть — остаётся
    getSlotsMock.mockResolvedValueOnce(twoDays)
    wrapper.findComponent(SlotList).vm.$emit('reload')
    await flushPromises()
    expect(select.props('modelValue')).toBe('2026-11-24')

    // выбранной даты больше нет — первая
    getSlotsMock.mockResolvedValueOnce(response(slot(4, '2026-11-25', 9)))
    wrapper.findComponent(SlotList).vm.$emit('reload')
    await flushPromises()
    expect(select.props('modelValue')).toBe('2026-11-25')
  })
})
