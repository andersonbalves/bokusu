import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PlayerPage } from './PlayerPage'
import type { ReactNode } from 'react'

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
)

let splashDisplayMode: 'integration' | 'cinematic' = 'integration'

beforeEach(() => {
  splashDisplayMode = 'integration'
  globalThis.fetch = vi.fn().mockImplementation((url) => {
    if (url.includes('/api/preferences')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ splash_display_mode: splashDisplayMode }),
      })
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    })
  })
})

test('integration mode: renders QR code and welcome message', async () => {
  splashDisplayMode = 'integration'
  render(<PlayerPage appUrl="http://192.168.1.10:5000" />, { wrapper })
  await waitFor(() => {
    expect(screen.getByTestId('qr-code')).toBeInTheDocument()
    expect(screen.getByText(/escaneie para cantar/i)).toBeInTheDocument()
  })
})

test('integration mode: renders host below QR', async () => {
  splashDisplayMode = 'integration'
  render(<PlayerPage appUrl="http://192.168.1.10:5000" />, { wrapper })
  await waitFor(() => {
    expect(screen.getByText('192.168.1.10:5000')).toBeInTheDocument()
  })
})

test('cinematic mode: renders QR in corner and IP address', async () => {
  splashDisplayMode = 'cinematic'
  render(<PlayerPage appUrl="http://192.168.1.10:5000" />, { wrapper })
  await waitFor(() => {
    expect(screen.getByTestId('qr-code')).toBeInTheDocument()
    expect(screen.getByText('192.168.1.10:5000')).toBeInTheDocument()
  })
})

test('cinematic mode: does not render welcome message', async () => {
  splashDisplayMode = 'cinematic'
  render(<PlayerPage appUrl="http://192.168.1.10:5000" />, { wrapper })
  await waitFor(() => {
    expect(screen.queryByText(/escaneie para cantar/i)).not.toBeInTheDocument()
  })
})
