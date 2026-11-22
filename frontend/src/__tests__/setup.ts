import { vi } from 'vitest'

// В jsdom нет matchMedia, а компоненты PrimeVue (Select, Dialog) его вызывают
vi.stubGlobal(
  'matchMedia',
  vi.fn((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn<() => void>(),
    removeEventListener: vi.fn<() => void>(),
  })),
)
