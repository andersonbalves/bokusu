import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PlayerPage } from './PlayerPage'
import { useAppStore } from '../store/useAppStore'
import type { ReactNode } from 'react'

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
)

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([]),
  })
})

test('integration mode: renders QR code and welcome message', () => {
  useAppStore.setState({ playerMode: 'integration' })
  render(<PlayerPage appUrl="http://192.168.1.10:5000" />, { wrapper })
  expect(screen.getByTestId('qr-code')).toBeInTheDocument()
  expect(screen.getByText(/escaneie para cantar/i)).toBeInTheDocument()
})

test('integration mode: renders host below QR', () => {
  useAppStore.setState({ playerMode: 'integration' })
  render(<PlayerPage appUrl="http://192.168.1.10:5000" />, { wrapper })
  expect(screen.getByText('192.168.1.10:5000')).toBeInTheDocument()
})

test('cinematic mode: renders QR in corner and IP address', () => {
  useAppStore.setState({ playerMode: 'cinematic' })
  render(<PlayerPage appUrl="http://192.168.1.10:5000" />, { wrapper })
  expect(screen.getByTestId('qr-code')).toBeInTheDocument()
  expect(screen.getByText('192.168.1.10:5000')).toBeInTheDocument()
})

test('cinematic mode: does not render welcome message', () => {
  useAppStore.setState({ playerMode: 'cinematic' })
  render(<PlayerPage appUrl="http://192.168.1.10:5000" />, { wrapper })
  expect(screen.queryByText(/escaneie para cantar/i)).not.toBeInTheDocument()
})
