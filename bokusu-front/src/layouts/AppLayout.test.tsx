import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppLayout } from './AppLayout'
import { useAppStore } from '../store/useAppStore'
import type { ReactNode } from 'react'

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter initialEntries={['/queue']}>{children}</MemoryRouter>
  </QueryClientProvider>
)

beforeEach(() => {
  useAppStore.setState({ isConnected: true })
})

test('renders three navigation links', () => {
  render(<AppLayout />, { wrapper })
  expect(screen.getAllByRole('link', { name: /fila/i })[0]).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: /buscar/i })[0]).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: /configurações/i })[0]).toBeInTheDocument()
})

test('shows connection error banner when disconnected', () => {
  useAppStore.setState({ isConnected: false })
  render(<AppLayout />, { wrapper })
  expect(screen.getByText(/sem conexão com o servidor/i)).toBeInTheDocument()
})

test('hides connection error banner when connected', () => {
  useAppStore.setState({ isConnected: true })
  render(<AppLayout />, { wrapper })
  expect(screen.queryByText(/sem conexão com o servidor/i)).not.toBeInTheDocument()
})