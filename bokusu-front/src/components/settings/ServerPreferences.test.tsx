import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ServerPreferences } from './ServerPreferences'
import { useAppStore } from '../../store/useAppStore'
import { vi, it, expect, afterEach } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
})

it('toggling disable_score PUTs the preference', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ success: true, message: 'ok' }))
  )
  vi.stubGlobal('fetch', fetchMock)
  useAppStore.setState({ isAdmin: true })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(['preferences'], { disable_score: false, splash_display_mode: 'integration' })
  render(
    <QueryClientProvider client={qc}>
      <ServerPreferences />
    </QueryClientProvider>
  )
  fireEvent.click(screen.getByRole('checkbox', { name: /score|pontu/i }))
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/preferences/disable_score',
      expect.objectContaining({ method: 'PUT' })
    )
  )
})
