import type { components, paths } from './schema'
import { request } from './client'

// Типы — из OpenAPI-схемы backend (make types), руками не описываем
export type Slot = components['schemas']['SlotResource']
export type SlotsResponse = paths['/slots']['get']['responses'][200]['content']['application/json']
export type BookingBody = Omit<components['schemas']['StoreBookingRequest'], 'idempotency_key'>
type CreatedBooking = paths['/bookings']['post']['responses'][201]['content']['application/json']

export function getSlots(): Promise<SlotsResponse> {
  return request('GET', '/api/slots')
}

/** Все попытки из одной формы — с одним ключом: повтор после потерянного ответа вернёт ту же бронь. */
export function createBooking(body: BookingBody, idempotencyKey: string): Promise<CreatedBooking> {
  return request('POST', '/api/bookings', body, { 'Idempotency-Key': idempotencyKey })
}

export function cancelBooking(id: number): Promise<void> {
  return request('DELETE', `/api/bookings/${id}`)
}

/**
 * UUID v4 из crypto.getRandomValues. Готовый crypto.randomUUID() браузер даёт только
 * в безопасном контексте (https, localhost), а страницу открывают и с телефона по http://<IP>.
 */
export function newIdempotencyKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6]! & 0x0f) | 0x40 // версия 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80 // вариант RFC 9562
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
