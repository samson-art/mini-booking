// Всё время — в поясе расписания (из ответа API), а не в поясе браузера

type SlotTimes = { starts_at: string; ends_at: string }

export function timeLabel(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('ru-RU', { timeZone, hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  )
}

export function slotRange(slot: SlotTimes, timeZone: string): string {
  return `${timeLabel(slot.starts_at, timeZone)}–${timeLabel(slot.ends_at, timeZone)}`
}

/** Ключ дня для фильтра: '2026-11-23'. */
export function dateKey(iso: string, timeZone: string): string {
  // en-CA форматирует дату как YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

/** Подпись дня: 'пн, 23 ноября'. */
export function dateLabel(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso))
}

/** 'пн, 23 ноября, 09:00–10:00' — для формы и подтверждения отмены. */
export function slotLabel(slot: SlotTimes, timeZone: string): string {
  return `${dateLabel(slot.starts_at, timeZone)}, ${slotRange(slot, timeZone)}`
}
