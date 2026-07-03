import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSearch } from './useSearch'
import type { ReactNode } from 'react'

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

afterEach(() => vi.unstubAllGlobals())

test('useSearch fetches from /api/search with query param', async () => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([{ id: 'abc', title: 'Found Song', url: 'https://youtube.com/watch?v=abc' }]),
  })
  const { result } = renderHook(() => useSearch('rock'), { wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data?.[0].title).toBe('Found Song')
  expect(result.current.data?.[0].id).toBe('abc')
  expect(fetch).toHaveBeenCalledWith('/api/search?q=rock', expect.any(Object))
})

test('useSearch is disabled when query is empty', () => {
  const { result } = renderHook(() => useSearch(''), { wrapper })
  expect(result.current.fetchStatus).toBe('idle')
})
