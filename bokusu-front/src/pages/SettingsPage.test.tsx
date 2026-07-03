import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { SettingsPage } from './SettingsPage'
import { useAppStore } from '../store/useAppStore'
import type { ReactNode } from 'react'
import { vi, test, expect, beforeEach, afterEach } from 'vitest'

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
)

let fetchMock: any

beforeEach(() => {
  useAppStore.setState({ theme: 'aqua', isAdmin: false })
  fetchMock = vi.fn().mockImplementation((url) => {
    if (url.includes('/api/preferences')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ splash_display_mode: 'integration' }),
      })
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    })
  })
  globalThis.fetch = fetchMock
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('renders theme and language sections', async () => {
  render(<SettingsPage />, { wrapper })
  expect(await screen.findByText(/tema/i)).toBeInTheDocument()
  expect(screen.getByText(/^idioma$/i)).toBeInTheDocument()
})

test('clicking Acid radio updates store theme to acid', async () => {
  render(<SettingsPage />, { wrapper })
  const radio = await screen.findByRole('radio', { name: /^acid$/i })
  fireEvent.click(radio)
  expect(useAppStore.getState().theme).toBe('acid')
})

test('clicking Cinemático radio updates store playerMode to cinematic when admin', async () => {
  useAppStore.setState({ isAdmin: true })
  render(<SettingsPage />, { wrapper })
  const radio = await screen.findByRole('radio', { name: /cinemático/i })
  fireEvent.click(radio)
  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/preferences/splash_display_mode',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ value: 'cinematic' }),
      })
    )
  })
})

test('shows admin login button when not admin', async () => {
  render(<SettingsPage />, { wrapper })
  expect(await screen.findByRole('button', { name: /entrar como admin/i })).toBeInTheDocument()
})

test('shows logout button when isAdmin=true', async () => {
  useAppStore.setState({ isAdmin: true })
  render(<SettingsPage />, { wrapper })
  expect(await screen.findByRole('button', { name: /sair do modo admin/i })).toBeInTheDocument()
})
