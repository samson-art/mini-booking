import type { components, paths } from './schema'
import { request } from './client'

// Типы — из OpenAPI-схемы backend (make types), руками не описываем
export type Slot = components['schemas']['SlotResource']
export type SlotsResponse = paths['/slots']['get']['responses'][200]['content']['application/json']

export function getSlots(): Promise<SlotsResponse> {
  return request('GET', '/api/slots')
}
