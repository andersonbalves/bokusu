import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useNowPlaying } from './useNowPlaying'
import type { ReactNode } from 'react'
import type { NowPlaying } from '../types/api'

vi.mock('./useSocketEvent', () => ({ useSocketEvent: vi.fn() }))

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

afterEach(() => vi.unstubAllGlobals())

const mockNowPlaying: NowPlaying = {
  now_playing: 'Bohemian Rhapsody',
  now_playing_user: 'Alice',
  now_playing_duration: 354,
  now_playing_transpose: 0,
  now_playing_url: '/stream/abc',
  now_playing_subtitle_url: null,
  now_playing_position: 42,
  is_paused: false,
  up_next: 'Hotel California',
  next_user: 'Bob',
  volume: 0.8,
}

test('useNowPlaying fetches from /api/player', async () => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockNowPlaying),
  })
  const { result } = renderHook(() => useNowPlaying(), { wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data?.now_playing).toBe('Bohemian Rhapsody')
  expect(result.current.data?.now_playing_user).toBe('Alice')
  expect(fetch).toHaveBeenCalledWith('/api/player', expect.any(Object))
})

test('useNowPlaying uses useSocketEvent for now_playing events', async () => {
  const { useSocketEvent } = await import('./useSocketEvent')
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockNowPlaying),
  })
  renderHook(() => useNowPlaying(), { wrapper })
  expect(useSocketEvent).toHaveBeenCalledWith('now_playing', expect.any(Function))
})

test('useNowPlaying returns null now_playing when idle', async () => {
  const idle: NowPlaying = { ...mockNowPlaying, now_playing: null, now_playing_user: null }
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(idle),
  })
  const { result } = renderHook(() => useNowPlaying(), { wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data?.now_playing).toBeNull()
})
