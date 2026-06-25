import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useQueue } from './useQueue'
import type { ReactNode } from 'react'

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

test('useQueue fetches from /api/queue', async () => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([{ id: '1', title: 'Test Song', singerName: 'Alice', position: 0 }]),
  })
  const { result } = renderHook(() => useQueue(), { wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data?.[0].title).toBe('Test Song')
  expect(fetch).toHaveBeenCalledWith('/api/queue')
})
