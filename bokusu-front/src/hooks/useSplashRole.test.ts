import { renderHook, act } from '@testing-library/react'
import { vi, expect, test, beforeEach } from 'vitest'

type Handler = (...args: unknown[]) => void
const handlers: Record<string, Handler[]> = {}
const emit = vi.fn()

vi.mock('../lib/socket', () => ({
  socket: {
    connected: true,
    emit: (...args: unknown[]) => emit(...args),
    on: (event: string, cb: Handler) => {
      handlers[event] = [...(handlers[event] ?? []), cb]
    },
    off: (event: string, cb: Handler) => {
      handlers[event] = (handlers[event] ?? []).filter((h) => h !== cb)
    },
  },
}))

import { useSplashRole } from './useSplashRole'

const fire = (event: string, ...args: unknown[]) => {
  for (const h of handlers[event] ?? []) h(...args)
}

beforeEach(() => {
  emit.mockClear()
  for (const key of Object.keys(handlers)) delete handlers[key]
})

test('registers as splash on mount when already connected', () => {
  const { result } = renderHook(() => useSplashRole())
  expect(emit).toHaveBeenCalledWith('register_splash')
  expect(result.current).toBeNull()
})

test('stores role from splash_role event', () => {
  const { result } = renderHook(() => useSplashRole())
  act(() => fire('splash_role', 'master'))
  expect(result.current).toBe('master')
})

test('re-registers on reconnect', () => {
  renderHook(() => useSplashRole())
  emit.mockClear()
  act(() => fire('connect'))
  expect(emit).toHaveBeenCalledWith('register_splash')
})

test('cleans up listeners on unmount', () => {
  const { unmount } = renderHook(() => useSplashRole())
  unmount()
  expect(handlers['connect'] ?? []).toHaveLength(0)
  expect(handlers['splash_role'] ?? []).toHaveLength(0)
})
