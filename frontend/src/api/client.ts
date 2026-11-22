const FALLBACK_MESSAGE = 'Не удалось отправить запрос. Попробуйте ещё раз.'

/** Ошибка запроса: status 0 — сеть или таймаут, errors — ошибки полей при 422. */
export class ApiError extends Error {
  readonly status: number
  readonly errors: Record<string, string[]>

  constructor(status: number, message: string, errors: Record<string, string[]> = {}) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

export async function request<T>(
  method: string,
  url: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      // Зависший backend не должен держать кнопку в loading вечно
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new ApiError(0, FALLBACK_MESSAGE)
  }

  if (response.status === 204) {
    return undefined as T
  }

  // У 5xx бывает HTML вместо JSON — тогда запасное сообщение
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(response.status, data?.message ?? FALLBACK_MESSAGE, data?.errors ?? {})
  }
  return data as T
}
