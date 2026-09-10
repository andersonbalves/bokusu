import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRenamerSongs, useApplyRename } from './useRenamer'
import type { ReactNode } from 'react'
import { vi, it, expect, afterEach } from 'vitest'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('fetches renamer songs with filters', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ songs: [], total: 0, page: 1 }))
  )
  vi.stubGlobal('fetch', fetchMock)
  renderHook(() => useRenamerSongs({ page: 1, onlyMismatched: true }), { wrapper })
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/renamer/songs?page=1&only_mismatched=true',
      expect.anything()
    )
  )
})

it('applies a rename', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ success: true, message: 'ok' }))
  )
  vi.stubGlobal('fetch', fetchMock)
  const { result } = renderHook(() => useApplyRename(), { wrapper })
  result.current.mutate({ oldName: '/x/bad.mp4', newName: 'Good' })
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/renamer/rename',
      expect.objectContaining({ method: 'POST' })
    )
  )
})
