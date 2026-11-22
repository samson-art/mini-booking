import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import SlotList from '../SlotList.vue'
import type { Slot } from '@/api/bookings'

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

describe('SlotList', () => {
  it('shows time, status tag and the matching action; past rows are muted', () => {
    const wrapper = mount(SlotList, {
      props: {
        slots: [
          slot(1, 9, 'past'),
          slot(2, 10, 'past'),
          slot(3, 11, 'booked'),
          slot(4, 12, 'available'),
        ],
        timezone: 'Europe/Moscow',
      },
      global: { plugins: [PrimeVue] },
    })

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
})
