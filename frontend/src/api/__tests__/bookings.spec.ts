import { describe, expect, it } from 'vitest'
import { newIdempotencyKey } from '../bookings'

describe('newIdempotencyKey', () => {
  it('returns a random UUID v4', () => {
    const key = newIdempotencyKey()
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(newIdempotencyKey()).not.toBe(key)
  })
})
