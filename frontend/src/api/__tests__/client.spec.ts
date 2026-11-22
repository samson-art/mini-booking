import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, request } from '../client'

const fetchMock = vi.fn<typeof fetch>()
vi.stubGlobal('fetch', fetchMock)

function respond(status: number, body?: unknown, contentType = 'application/json') {
  const text = body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body)
  fetchMock.mockResolvedValueOnce(
    new Response(text, { status, headers: { 'Content-Type': contentType } }),
  )
}

async function catchError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (error) {
    return error as ApiError
  }
  throw new Error('request did not fail')
}

afterEach(() => fetchMock.mockReset())

describe('request', () => {
  it('returns parsed JSON for 2xx and undefined for 204', async () => {
    respond(200, { data: [1] })
    expect(await request('GET', '/api/slots')).toEqual({ data: [1] })

    respond(204)
    expect(await request('DELETE', '/api/bookings/1')).toBeUndefined()
  })

  it('throws ApiError with server message and field errors', async () => {
    respond(422, { message: 'Укажите имя.', errors: { customer_name: ['Укажите имя.'] } })
    const validation = await catchError(request('POST', '/api/bookings', {}))
    expect(validation).toBeInstanceOf(ApiError)
    expect(validation).toMatchObject({
      status: 422,
      message: 'Укажите имя.',
      errors: { customer_name: ['Укажите имя.'] },
    })

    respond(409, { message: 'Этот слот уже занят.' })
    expect(await catchError(request('POST', '/api/bookings', {}))).toMatchObject({
      status: 409,
      message: 'Этот слот уже занят.',
    })

    respond(429, { message: 'Слишком много запросов. Попробуйте через минуту.' })
    expect((await catchError(request('POST', '/api/bookings', {}))).message).toBe(
      'Слишком много запросов. Попробуйте через минуту.',
    )
  })

  it('survives a non-JSON server error page', async () => {
    respond(500, '<html>Server Error</html>', 'text/html')
    expect(await catchError(request('GET', '/api/slots'))).toMatchObject({
      status: 500,
      message: 'Не удалось отправить запрос. Попробуйте ещё раз.',
    })
  })

  it('turns network failure and timeout into status 0, sends signal and headers', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect((await catchError(request('GET', '/api/slots'))).status).toBe(0)

    fetchMock.mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'))
    expect((await catchError(request('GET', '/api/slots'))).status).toBe(0)

    respond(201, { data: { id: 1 } })
    await request('POST', '/api/bookings', { slot_id: 1 }, { 'Idempotency-Key': 'key-1' })
    const init = fetchMock.mock.lastCall?.[1] as RequestInit
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe('key-1')
    expect(init.body).toBe(JSON.stringify({ slot_id: 1 }))
  })
})
