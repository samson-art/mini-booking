import { afterEach, describe, expect, it, vi } from 'vitest'
import { getSlots, type SlotsResponse } from '@/api/bookings'
import { ApiError } from '@/api/client'
import { useSlots } from '../useSlots'

vi.mock('@/api/bookings', () => ({ getSlots: vi.fn<typeof import('@/api/bookings').getSlots>() }))
const getSlotsMock = vi.mocked(getSlots)

function response(id: number): SlotsResponse {
  return {
    data: [
      {
        id,
        starts_at: '2026-11-23T09:00:00+03:00',
        ends_at: '2026-11-23T10:00:00+03:00',
        status: 'available',
        booking_id: null,
      },
    ],
    meta: { timezone: 'Europe/Moscow' },
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

afterEach(() => getSlotsMock.mockReset())

describe('useSlots', () => {
  it('ignores a stale response that arrives after a newer one', async () => {
    const first = deferred<SlotsResponse>()
    const second = deferred<SlotsResponse>()
    getSlotsMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { slots, load } = useSlots()

    const firstLoad = load()
    const secondLoad = load()
    second.resolve(response(2))
    await secondLoad
    first.resolve(response(1))
    await firstLoad

    expect(slots.value.map((s) => s.id)).toEqual([2])
  })

  it('keeps slots on a failed reload and clears the error on the next success', async () => {
    const { slots, error, load } = useSlots()

    getSlotsMock.mockResolvedValueOnce(response(1))
    await load()
    getSlotsMock.mockRejectedValueOnce(new ApiError(0, 'нет сети'))
    await load()

    expect(error.value).toBe('Не удалось загрузить расписание.')
    expect(slots.value.map((s) => s.id)).toEqual([1])

    getSlotsMock.mockResolvedValueOnce(response(3))
    await load()
    expect(error.value).toBeNull()
    expect(slots.value.map((s) => s.id)).toEqual([3])
  })
})
