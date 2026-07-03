import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useFiles, useDeleteFile, useRenameFile } from './useFiles'
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

test('useFiles fetches files with pagination and parameters', async () => {
  const mockResponse = {
    files: [{ path: '/songs/A.mp4', displayName: 'A' }],
    total: 1,
    page: 1,
    perPage: 10,
  }
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockResponse),
  })

  const { result } = renderHook(() => useFiles({ q: 'test', letter: 'a', sort: 'date', page: 2 }), { wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data).toEqual(mockResponse)
  expect(fetch).toHaveBeenCalledWith('/api/files/browse?q=test&letter=a&sort=date&page=2', expect.any(Object))
})

test('useDeleteFile calls DELETE endpoint', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ success: true, message: 'deleted' }),
  })
  globalThis.fetch = fetchMock

  const { result } = renderHook(() => useDeleteFile(), { wrapper })
  result.current.mutate('/songs/A.mp4')

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/files?song=%2Fsongs%2FA.mp4',
    expect.objectContaining({
      method: 'DELETE',
    })
  )
})

test('useRenameFile calls PATCH endpoint', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ success: true, message: 'renamed' }),
  })
  globalThis.fetch = fetchMock

  const { result } = renderHook(() => useRenameFile(), { wrapper })
  result.current.mutate({
    old_file_name: '/songs/A.mp4',
    new_file_name: 'B',
  })

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/files',
    expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({
        old_file_name: '/songs/A.mp4',
        new_file_name: 'B',
      }),
    })
  )
})
