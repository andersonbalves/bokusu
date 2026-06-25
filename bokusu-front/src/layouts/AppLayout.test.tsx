import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppLayout } from './AppLayout'
import type { ReactNode } from 'react'

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter initialEntries={['/queue']}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
)

test('renders three navigation links', () => {
  render(<AppLayout />, { wrapper })
  expect(screen.getAllByRole('link', { name: /fila/i })[0]).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: /buscar/i })[0]).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: /configurações/i })[0]).toBeInTheDocument()
})
