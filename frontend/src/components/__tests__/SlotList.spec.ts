import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import SlotList from '../SlotList.vue'
import { cancelBooking, type Slot } from '@/api/bookings'
import { ApiError } from '@/api/client'

vi.mock('@/api/bookings', () => ({
  cancelBooking: vi.fn<typeof import('@/api/bookings').cancelBooking>(),
}))
const cancelBookingMock = vi.mocked(cancelBooking)

const toastAdd =
  vi.fn<(message: { severity?: string; summary?: string; detail?: string }) => void>()
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }))

// Подтверждение сразу принимается; текст и кнопки диалога проверяет E1
type ConfirmOptions = { message?: string; accept?: () => void }
const confirmRequire = vi.fn<(options: ConfirmOptions) => void>((options) => options.accept?.())
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: confirmRequire }) }))

function slot(id: number, hour: number, status: Slot['status']): Slot {
  const h = String(hour).padStart(2, '0')
  const next = String(hour + 1).padStart(2, '0')
  return {
    id,
    starts_at: `2026-11-23T${h}:00:00+03:00`,
    ends_at: `2026-11-23T${next}:00:00+03:00`,
    status,
    booking_id: status === 'available' ? null : id * 10,
  }
}

function mountList(slots: Slot[]) {
  return mount(SlotList, {
    props: { slots, timezone: 'Europe/Moscow' },
    global: { plugins: [PrimeVue] },
  })
}

afterEach(() => {
  cancelBookingMock.mockReset()
  toastAdd.mockReset()
  confirmRequire.mockClear()
})

describe('SlotList', () => {
  it('shows time, status tag and the matching action; past rows are muted', () => {
    const wrapper = mountList([
      slot(1, 9, 'past'),
      slot(2, 10, 'past'),
      slot(3, 11, 'booked'),
      slot(4, 12, 'available'),
    ])

    const rows = wrapper.findAll('[data-testid="slot"]')
    expect(rows.map((r) => r.text())).toEqual([
      '09:00–10:00Прошёл',
      '10:00–11:00Прошёл', // прошедший с бронью — тоже без действий
      '11:00–12:00ЗанятоОтменить',
      '12:00–13:00СвободноЗабронировать',
    ])
    expect(rows.map((r) => r.classes('slot--past'))).toEqual([true, true, false, false])
    expect(rows[0]!.find('button').exists()).toBe(false)
  })

  it('cancels after confirmation with the row button loading, then reloads', async () => {
    let finish!: () => void
    cancelBookingMock.mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)))
    const wrapper = mountList([slot(3, 11, 'booked')])

    const button = wrapper.get('button')
    await button.trigger('click')

    expect(confirmRequire.mock.lastCall?.[0].message).toBe(
      'Отменить бронирование: пн, 23 ноября, 11:00–12:00?',
    )
    expect(cancelBookingMock).toHaveBeenCalledWith(30)
    expect(button.attributes('disabled')).toBeDefined()

    finish()
    await flushPromises()
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ summary: 'Бронирование отменено' }),
    )
    expect(wrapper.emitted('reload')).toHaveLength(1)
  })

  it('treats 404 as already cancelled and explains 409, reloading both times', async () => {
    const wrapper = mountList([slot(3, 11, 'booked')])

    cancelBookingMock.mockRejectedValueOnce(new ApiError(404, 'Не найдено.'))
    await wrapper.get('button').trigger('click')
    await flushPromises()

    cancelBookingMock.mockRejectedValueOnce(
      new ApiError(409, 'Этот слот уже прошёл, бронь нельзя отменить.'),
    )
    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(toastAdd.mock.calls[1]?.[0]).toMatchObject({
      detail: 'Этот слот уже прошёл, бронь нельзя отменить.',
    })
    expect(wrapper.emitted('reload')).toHaveLength(2)
  })

  it('shows an error and re-enables the button on network, server and rate-limit errors', async () => {
    const wrapper = mountList([slot(3, 11, 'booked')])
    const cases: [ApiError, string][] = [
      [new ApiError(0, 'нет сети'), 'Не удалось отменить бронирование. Попробуйте ещё раз.'],
      [new ApiError(500, 'Server Error'), 'Не удалось отменить бронирование. Попробуйте ещё раз.'],
      [
        new ApiError(429, 'Слишком много запросов. Попробуйте через минуту.'),
        'Слишком много запросов. Попробуйте через минуту.',
      ],
    ]

    for (const [error, message] of cases) {
      cancelBookingMock.mockRejectedValueOnce(error)
      await wrapper.get('button').trigger('click')
      await flushPromises()
      expect(toastAdd.mock.lastCall?.[0]).toMatchObject({ severity: 'error', detail: message })
      expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
    }
    expect(wrapper.emitted('reload')).toBeUndefined()
  })
})
