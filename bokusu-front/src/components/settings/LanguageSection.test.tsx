import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LanguageSection } from './LanguageSection'
import { useAppStore } from '../../store/useAppStore'
import { vi, it, expect, afterEach } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
})

it('changing language persists preferred_language on the server', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ success: true, message: 'ok' }))
  )
  vi.stubGlobal('fetch', fetchMock)
  useAppStore.setState({ isAdmin: true })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(['preferences'], { splash_display_mode: 'integration' })
  render(
    <QueryClientProvider client={qc}>
      <LanguageSection />
    </QueryClientProvider>
  )
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'en' } })
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/preferences/preferred_language',
      expect.objectContaining({ method: 'PUT' })
    )
  )
})
