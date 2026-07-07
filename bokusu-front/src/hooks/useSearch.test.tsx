import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSearch, useSearchAutocomplete, useSearchPreview } from './useSearch'
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

test('useSearch is disabled for queries shorter than the minimum length', () => {
  const fetchMock = vi.fn()
  globalThis.fetch = fetchMock
  const { result } = renderHook(() => useSearch('ro'), { wrapper })
  expect(result.current.fetchStatus).toBe('idle')
  expect(fetchMock).not.toHaveBeenCalled()
})

test('useSearchAutocomplete fetches autocomplete matching songs', async () => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([{ path: '/s/song.mp4', fileName: 'Song.mp4', type: 'autocomplete' }]),
  })
  const { result } = renderHook(() => useSearchAutocomplete('queen'), { wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data?.[0].fileName).toBe('Song.mp4')
  expect(fetch).toHaveBeenCalledWith('/api/search/autocomplete?q=queen', expect.any(Object))
})

test('useSearchAutocomplete is disabled for queries shorter than the minimum length', () => {
  const fetchMock = vi.fn()
  globalThis.fetch = fetchMock
  const { result } = renderHook(() => useSearchAutocomplete('a'), { wrapper })
  expect(result.current.fetchStatus).toBe('idle')
  expect(fetchMock).not.toHaveBeenCalled()
})

test('useSearchPreview fetches direct stream URL', async () => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ stream_url: 'https://stream.youtube.com/abc' }),
  })
  const { result } = renderHook(() => useSearchPreview('https://youtube.com/watch?v=123'), { wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data?.stream_url).toBe('https://stream.youtube.com/abc')
  expect(fetch).toHaveBeenCalledWith('/api/search/preview?url=https%3A%2F%2Fyoutube.com%2Fwatch%3Fv%3D123', expect.any(Object))
})
