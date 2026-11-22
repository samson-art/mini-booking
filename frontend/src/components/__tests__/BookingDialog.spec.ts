import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Dialog from 'primevue/dialog'
import BookingDialog from '../BookingDialog.vue'
import { createBooking, type Slot } from '@/api/bookings'
import { ApiError } from '@/api/client'

vi.mock('@/api/bookings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/bookings')>()),
  createBooking: vi.fn<typeof import('@/api/bookings').createBooking>(),
}))
const createBookingMock = vi.mocked(createBooking)

const toastAdd = vi.fn<(message: { summary?: string; detail?: string }) => void>()
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }))

const slot: Slot = {
  id: 7,
  starts_at: '2026-11-23T10:00:00+03:00',
  ends_at: '2026-11-23T11:00:00+03:00',
  status: 'available',
  booking_id: null,
}

let wrapper: ReturnType<typeof mountDialog>

function mountDialog() {
  return mount(BookingDialog, {
    props: { visible: true, bookingSlot: slot, timezone: 'Europe/Moscow' },
    global: { plugins: [PrimeVue] },
    attachTo: document.body, // Dialog рендерится в body
  })
}

// Содержимое Dialog телепортируется в body — ищем там
const body = () => new DOMWrapper(document.body)
const nameInput = () => body().get<HTMLInputElement>('#booking-name')
const emailInput = () => body().get<HTMLInputElement>('#booking-email')
const submitButton = () => body().get('button[type="submit"]')

async function fillAndSubmit(name = 'Анна', email = 'anna@example.com') {
  await nameInput().setValue(name)
  await emailInput().setValue(email)
  await body().get('form').trigger('submit')
}

beforeEach(() => {
  wrapper = mountDialog()
})

afterEach(() => {
  wrapper.unmount()
  createBookingMock.mockReset()
  toastAdd.mockReset()
})

describe('BookingDialog', () => {
  it('shows the slot with its date and validates fields in the browser', async () => {
    expect(body().text()).toContain('Бронирование: пн, 23 ноября, 10:00–11:00')

    await fillAndSubmit('', '')
    expect(body().text()).toContain('Укажите имя.')
    expect(body().text()).toContain('Укажите email.')

    await fillAndSubmit('   ', 'not-an-email')
    expect(body().text()).toContain('Укажите имя.')
    expect(body().text()).toContain('Неверный email.')

    expect(createBookingMock).not.toHaveBeenCalled()
  })

  it('blocks the button, repeated submits and closing while the request is pending', async () => {
    createBookingMock.mockReturnValue(new Promise(() => {}))

    await fillAndSubmit()
    await body().get('form').trigger('submit') // Enter ещё раз
    await submitButton().trigger('click')

    expect(createBookingMock).toHaveBeenCalledTimes(1)
    expect(submitButton().attributes('disabled')).toBeDefined()
    const dialog = wrapper.findComponent(Dialog)
    expect(dialog.props('closable')).toBe(false)
    expect(dialog.props('closeOnEscape')).toBe(false)
  })

  it('closes, reports success and asks for a reload on 201', async () => {
    createBookingMock.mockResolvedValue({ data: { id: 1 } })

    await fillAndSubmit(' Анна ', ' anna@example.com ')
    await flushPromises()

    expect(createBookingMock).toHaveBeenCalledWith(
      { slot_id: 7, customer_name: 'Анна', customer_email: 'anna@example.com' },
      expect.any(String),
    )
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ summary: 'Слот забронирован' }))
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
    expect(wrapper.emitted('reload')).toHaveLength(1)
  })

  it('shows server field errors and slot errors as a general message on 422', async () => {
    createBookingMock.mockRejectedValueOnce(
      new ApiError(422, 'Неверный email.', { customer_email: ['Неверный email.'] }),
    )
    await fillAndSubmit()
    await flushPromises()
    expect(emailInput().element.closest('.field')?.textContent).toContain('Неверный email.')

    createBookingMock.mockRejectedValueOnce(
      new ApiError(422, 'Такого слота нет.', { slot_id: ['Такого слота нет.'] }),
    )
    await body().get('form').trigger('submit')
    await flushPromises()
    expect(body().get('[data-testid="form-error"]').text()).toBe('Такого слота нет.')
  })

  it('closes with the server reason and asks for a reload on 409', async () => {
    createBookingMock.mockRejectedValue(new ApiError(409, 'Этот слот уже занят.'))

    await fillAndSubmit()
    await flushPromises()

    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Этот слот уже занят.' }),
    )
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
    expect(wrapper.emitted('reload')).toHaveLength(1)
  })

  it('keeps the form and the key for a retry after 429, network or server errors', async () => {
    const cases: [ApiError, string][] = [
      [
        new ApiError(429, 'Слишком много запросов. Попробуйте через минуту.'),
        'Слишком много запросов. Попробуйте через минуту.',
      ],
      [new ApiError(0, 'нет сети'), 'Не удалось отправить запрос. Попробуйте ещё раз.'],
      [new ApiError(500, 'Server Error'), 'Не удалось отправить запрос. Попробуйте ещё раз.'],
    ]

    await nameInput().setValue('Анна')
    await emailInput().setValue('anna@example.com')
    for (const [error, message] of cases) {
      createBookingMock.mockRejectedValueOnce(error)
      await body().get('form').trigger('submit')
      await flushPromises()
      expect(body().get('[data-testid="form-error"]').text()).toBe(message)
      expect(nameInput().element.value).toBe('Анна')
      expect(submitButton().attributes('disabled')).toBeUndefined()
    }

    createBookingMock.mockResolvedValueOnce({ data: { id: 1 } })
    await body().get('form').trigger('submit')
    await flushPromises()

    const keys = createBookingMock.mock.calls.map((call) => call[1])
    expect(new Set(keys).size).toBe(1) // все попытки — с одним ключом

    // закрыли и открыли снова — новый ключ
    await wrapper.setProps({ visible: false })
    await wrapper.setProps({ visible: true })
    await fillAndSubmit()
    expect(createBookingMock.mock.lastCall?.[1]).not.toBe(keys[0])
  })
})
