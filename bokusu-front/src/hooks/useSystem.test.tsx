import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSystemAction } from './useSystem'
import type { ReactNode } from 'react'
import { vi, it, expect, afterEach } from 'vitest'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('useSystemAction POSTs to the action endpoint', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ status: 'started' }))
  )
  vi.stubGlobal('fetch', fetchMock)
  const { result } = renderHook(() => useSystemAction(), { wrapper })
  result.current.mutate('update-ytdl')
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/system/update-ytdl',
      expect.objectContaining({ method: 'POST' })
    )
  )
})
