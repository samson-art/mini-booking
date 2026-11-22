import { describe, expect, it } from 'vitest'
import { dateKey, dateLabel, slotLabel, slotRange, timeLabel } from '../time'

const tz = 'Europe/Moscow'
const slot = { starts_at: '2026-11-23T09:00:00+03:00', ends_at: '2026-11-23T10:00:00+03:00' }

describe('time', () => {
  it('formats time, range and full slot label in the schedule timezone', () => {
    expect(timeLabel(slot.starts_at, tz)).toBe('09:00')
    expect(slotRange(slot, tz)).toBe('09:00–10:00')
    expect(slotLabel(slot, tz)).toBe('пн, 23 ноября, 09:00–10:00')
  })

  it('computes the date in the schedule timezone', () => {
    expect(dateKey('2026-11-22T21:30:00Z', tz)).toBe('2026-11-23')
  })

  it('labels the date in the schedule timezone, not the machine one', () => {
    // Vitest запущен с TZ=America/New_York: там это ещё воскресенье, 22-е
    expect(dateLabel('2026-11-22T21:30:00Z', tz)).toBe('пн, 23 ноября')
  })
})
