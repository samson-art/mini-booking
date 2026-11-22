import { expect, test, type APIRequestContext } from '@playwright/test'

// Брони, созданные тестом: afterEach отменяет их, даже если тест упал посередине
let created: number[] = []

test.afterEach(async ({ request }) => {
  for (const id of created) {
    await request.delete(`/api/bookings/${id}`)
  }
  created = []
})

const body = (slotId: number) => ({
  slot_id: slotId,
  customer_name: 'E2E',
  customer_email: 'e2e@example.com',
})

type Slot = { id: number; starts_at: string; status: string }

/** Свободные слоты завтрашнего дня (по поясу расписания из ответа API). */
async function tomorrowFreeSlots(request: APIRequestContext): Promise<Slot[]> {
  const { data, meta } = (await (await request.get('/api/slots')).json()) as {
    data: Slot[]
    meta: { timezone: string }
  }
  const day = (iso: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: meta.timezone }).format(new Date(iso))
  const days = [...new Set(data.map((slot) => day(slot.starts_at)))]
  return data.filter((slot) => day(slot.starts_at) === days[1] && slot.status === 'available')
}

test('E1: book a slot after a lost response, then cancel it', async ({ page }) => {
  await page.goto('/')

  // Завтра — вторая дата в фильтре (первая — сегодня по серверу)
  await page.getByRole('combobox', { name: 'Дата' }).click()
  await page.getByRole('option').nth(1).click()

  // Браузер в Нью-Йорке, а время на странице — по расписанию
  await expect(page.getByTestId('slot').first()).toContainText('09:00–10:00')

  const row = page.getByTestId('slot').filter({ hasText: 'Свободно' }).first()
  const time = (await row.textContent())!.slice(0, 11) // «09:00–10:00»
  const slotRow = page.getByTestId('slot').filter({ hasText: time })
  await row.getByRole('button', { name: 'Забронировать' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Имя').fill('E2E')
  await dialog.getByLabel('Email').fill('e2e@example.com')

  // Первый ответ теряется: запрос доходит до backend и создаёт бронь, но страница ответа не получает
  await page.route(
    '**/api/bookings',
    async (route) => {
      const response = await route.fetch()
      created.push(((await response.json()) as { data: { id: number } }).data.id)
      await route.abort()
    },
    { times: 1 },
  )
  await dialog.getByRole('button', { name: 'Забронировать' }).click()
  await expect(dialog.getByText('Не удалось отправить запрос. Попробуйте ещё раз.')).toBeVisible()

  // Повтор идёт с тем же Idempotency-Key и получает ту же бронь, а не 409
  await dialog.getByRole('button', { name: 'Забронировать' }).click()
  await expect(page.getByText('Слот забронирован')).toBeVisible()
  await expect(slotRow).toContainText('Занято')

  await slotRow.getByRole('button', { name: 'Отменить' }).click()
  await page.getByRole('button', { name: 'Да, отменить' }).click()
  await expect(slotRow).toContainText('Свободно')
  created = [] // отменена через интерфейс

  // Строка слота не ломает вёрстку: на 375 px нет горизонтальной прокрутки
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})

// Только desktop (grepInvert в playwright.config.ts): от вьюпорта гонка не зависит, а лимит запросов общий
test('E2: concurrent requests create exactly one active booking', async ({ request }) => {
  const [first, second] = await tomorrowFreeSlots(request)

  // Без ключа: один выигрывает, остальные упираются в уникальный индекс
  const race = await Promise.all(
    [1, 2, 3].map(() => request.post('/api/bookings', { data: body(first!.id) })),
  )
  const winners = race.filter((response) => response.status() === 201)
  const losers = race.filter((response) => response.status() === 409)
  expect(winners).toHaveLength(1)
  expect(losers).toHaveLength(2)
  created.push((await winners[0]!.json()).data.id)
  for (const response of losers) {
    expect(await response.json()).toEqual({ message: 'Этот слот уже занят.' })
  }

  // С одним ключом: все получают ту же бронь (ветка «нарушение уникальности → поиск по ключу»)
  const key = crypto.randomUUID()
  const replays = await Promise.all(
    [1, 2, 3].map(() =>
      request.post('/api/bookings', {
        data: body(second!.id),
        headers: { 'Idempotency-Key': key },
      }),
    ),
  )
  expect(replays.map((response) => response.status())).toEqual([201, 201, 201])
  const ids = new Set(await Promise.all(replays.map(async (r) => (await r.json()).data.id)))
  expect(ids.size).toBe(1)
  created.push(...ids)
})
