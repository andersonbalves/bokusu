import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDownloads } from './useDownloads'
import type { ReactNode } from 'react'
import { vi, it, expect, beforeEach, afterEach } from 'vitest'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ active: null, pending: [], errors: [{ id: 'e1' }] }))
    )
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('fetches downloads status', async () => {
  const { result } = renderHook(() => useDownloads(), { wrapper })
  await waitFor(() => expect(result.current.data?.errors).toHaveLength(1))
})
