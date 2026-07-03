import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePreferences, useSetPreference } from './usePreferences'
import { useSocketEvent } from './useSocketEvent'
import type { ReactNode } from 'react'
import { vi, it, expect, afterEach, beforeEach } from 'vitest'

vi.mock('./useSocketEvent', () => ({
  useSocketEvent: vi.fn(),
}))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.mocked(useSocketEvent).mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('fetches preferences from /api/preferences', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ splash_display_mode: 'cinematic', volume: 0.85 }),
        { status: 200 }
      )
    )
  )
  const { result } = renderHook(() => usePreferences(), { wrapper })
  await waitFor(() => expect(result.current.data?.splash_display_mode).toBe('cinematic'))
})

it('useSetPreference PUTs to /api/preferences/<key>', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ success: true, message: 'ok' }), { status: 200 })
  )
  vi.stubGlobal('fetch', fetchMock)
  const { result } = renderHook(() => useSetPreference(), { wrapper })
  result.current.mutate({ key: 'volume', value: 0.5 })
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/preferences/volume',
      expect.objectContaining({ method: 'PUT' })
    )
  )
})

it('updates React Query cache when preferences_update socket event is received', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ splash_display_mode: 'cinematic', volume: 0.85 }),
        { status: 200 }
      )
    )
  )

  const { result } = renderHook(() => usePreferences(), { wrapper })
  await waitFor(() => expect(result.current.data?.volume).toBe(0.85))

  const calls = vi.mocked(useSocketEvent).mock.calls
  const onPreferencesUpdate = calls.find((c) => c[0] === 'preferences_update')?.[1]
  expect(onPreferencesUpdate).toBeDefined()

  onPreferencesUpdate!({ key: 'volume', value: 0.99 })
  await waitFor(() => expect(result.current.data?.volume).toBe(0.99))
})

it('invalidates React Query cache when preferences_reset socket event is received', async () => {
  let fetchCount = 0
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() => {
      fetchCount++
      return Promise.resolve(
        new Response(
          JSON.stringify({ splash_display_mode: 'cinematic', volume: 0.85 + fetchCount * 0.01 }),
          { status: 200 }
        )
      )
    })
  )

  const { result } = renderHook(() => usePreferences(), { wrapper })
  await waitFor(() => expect(result.current.data?.volume).toBe(0.86))
  expect(fetchCount).toBe(1)

  const calls = vi.mocked(useSocketEvent).mock.calls
  const onPreferencesReset = calls.find((c) => c[0] === 'preferences_reset')?.[1]
  expect(onPreferencesReset).toBeDefined()

  onPreferencesReset!()
  await waitFor(() => expect(result.current.data?.volume).toBe(0.87))
  expect(fetchCount).toBe(2)
})
