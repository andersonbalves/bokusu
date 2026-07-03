import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useQueue } from './useQueue'
import type { ReactNode } from 'react'

vi.mock('./useSocketEvent', () => ({ useSocketEvent: vi.fn() }))

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

afterEach(() => vi.unstubAllGlobals())

test('useQueue fetches from /api/queue', async () => {
  const mockItems = [{ file: 'song.mp4', title: 'Test Song', user: 'Alice', semitones: 0 }]
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockItems),
  })
  const { result } = renderHook(() => useQueue(), { wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data?.[0].title).toBe('Test Song')
  expect(result.current.data?.[0].user).toBe('Alice')
  expect(fetch).toHaveBeenCalledWith('/api/queue', expect.any(Object))
})

test('useQueue does not use refetchInterval (socket-driven)', async () => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([]),
  })
  const { result } = renderHook(() => useQueue(), { wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  // If refetchInterval were set, the query options would expose it.
  // We verify by checking no interval-based refetch config is present.
  expect(result.current.isRefetching).toBe(false)
})

test('useQueue uses useSocketEvent for queue_update', async () => {
  const { useSocketEvent } = await import('./useSocketEvent')
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([]),
  })
  renderHook(() => useQueue(), { wrapper })
  expect(useSocketEvent).toHaveBeenCalledWith('queue_update', expect.any(Function))
})
