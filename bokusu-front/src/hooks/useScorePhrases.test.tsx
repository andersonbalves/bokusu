import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useScorePhrases } from './useScorePhrases'
import type { ReactNode } from 'react'
import type { ScorePhrases } from '../types/api'

vi.mock('./useSocketEvent', () => ({ useSocketEvent: vi.fn() }))

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

afterEach(() => vi.unstubAllGlobals())

const mockPhrases: ScorePhrases = {
  low: ['Nunca mais cante.'],
  mid: ['Ok... só ok.'],
  high: ['Incrível!'],
}

test('useScorePhrases fetches from /api/player/score-phrases', async () => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockPhrases),
  })
  const { result } = renderHook(() => useScorePhrases(), { wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data?.high).toEqual(['Incrível!'])
  expect(fetch).toHaveBeenCalledWith('/api/player/score-phrases', expect.any(Object))
})

test('useScorePhrases subscribes to score_phrases_update', async () => {
  const { useSocketEvent } = await import('./useSocketEvent')
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockPhrases),
  })
  renderHook(() => useScorePhrases(), { wrapper })
  expect(useSocketEvent).toHaveBeenCalledWith('score_phrases_update', expect.any(Function))
})
