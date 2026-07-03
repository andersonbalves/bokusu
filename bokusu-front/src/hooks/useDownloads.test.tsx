import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDownloads, useStartDownload, useDismissDownloadError } from './useDownloads'
import type { ReactNode } from 'react'
import { vi, test, expect, afterEach } from 'vitest'

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('useDownloads fetches status from /api/downloads', async () => {
  const mockStatus = {
    active: { id: '1', title: 'Active', url: 'https://y', progress: 50, status: 'active' },
    pending: [],
    errors: [],
  }
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockStatus),
  })

  const { result } = renderHook(() => useDownloads(), { wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data).toEqual(mockStatus)
  expect(fetch).toHaveBeenCalledWith('/api/downloads', expect.any(Object))
})

test('useStartDownload posts to /api/downloads', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ status: 'ok' }),
  })
  globalThis.fetch = fetchMock

  const { result } = renderHook(() => useStartDownload(), { wrapper })
  result.current.mutate({
    song_url: 'https://youtube.com/watch?v=123',
    song_added_by: 'User',
    song_title: 'Title',
    queue: true,
  })

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/downloads',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        song_url: 'https://youtube.com/watch?v=123',
        song_added_by: 'User',
        song_title: 'Title',
        queue: true,
      }),
    })
  )
})

test('useDismissDownloadError deletes error by id', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ success: true }),
  })
  globalThis.fetch = fetchMock

  const { result } = renderHook(() => useDismissDownloadError(), { wrapper })
  result.current.mutate('error_id_123')

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/downloads/errors/error_id_123',
    expect.objectContaining({
      method: 'DELETE',
    })
  )
})
