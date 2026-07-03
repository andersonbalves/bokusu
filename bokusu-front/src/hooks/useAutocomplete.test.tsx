import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAutocomplete } from './useAutocomplete'
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
      new Response(JSON.stringify([{ path: '/x/a.mp4', fileName: 'A', type: 'autocomplete' }]))
    )
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('queries /api/search/autocomplete', async () => {
  const { result } = renderHook(() => useAutocomplete('a'), { wrapper })
  await waitFor(() => expect(result.current.data?.[0].fileName).toBe('A'))
})

it('is disabled for short queries', () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  renderHook(() => useAutocomplete(''), { wrapper })
  expect(fetchMock).not.toHaveBeenCalled()
})
