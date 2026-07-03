import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useLibrary, useDeleteFile } from './useLibrary'
import type { ReactNode } from 'react'
import { vi, it, expect, afterEach } from 'vitest'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('fetches library with query and page', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({ files: [{ path: '/a', displayName: 'A' }], total: 1, page: 2, perPage: 100 })
    )
  )
  vi.stubGlobal('fetch', fetchMock)
  const { result } = renderHook(() => useLibrary({ q: 'abba', page: 2 }), { wrapper })
  await waitFor(() => expect(result.current.data?.total).toBe(1))
  expect(fetchMock).toHaveBeenCalledWith('/api/files/browse?q=abba&page=2', expect.anything())
})

it('useDeleteFile DELETEs by path', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ success: true, message: 'ok' }))
  )
  vi.stubGlobal('fetch', fetchMock)
  const { result } = renderHook(() => useDeleteFile(), { wrapper })
  result.current.mutate('/x/a.mp4')
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/files?song=%2Fx%2Fa.mp4',
      expect.objectContaining({ method: 'DELETE' })
    )
  )
})
