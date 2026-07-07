import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LanguageSection } from './LanguageSection'
import { useAppStore } from '../../store/useAppStore'
import { vi, it, expect, afterEach } from 'vitest'
import i18n from '../../lib/i18n'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  i18n.changeLanguage('pt-BR')
  if (typeof localStorage !== 'undefined') {
    localStorage.clear()
  }
})

it('changing language to en persists preferred_language with correct body', async () => {
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
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ value: 'en' }) })
    )
  )
})

it('changing language to pt-BR persists preferred_language with mapped backend code', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ success: true, message: 'ok' }))
  )
  vi.stubGlobal('fetch', fetchMock)
  useAppStore.setState({ isAdmin: true })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(['preferences'], { splash_display_mode: 'integration' })

  // Start with 'en' so we can trigger a change event back to 'pt-BR'
  await i18n.changeLanguage('en')

  render(
    <QueryClientProvider client={qc}>
      <LanguageSection />
    </QueryClientProvider>
  )
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'pt-BR' } })
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/preferences/preferred_language',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ value: 'pt_BR' }) })
    )
  )
})
