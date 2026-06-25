import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SearchPage } from './SearchPage'
import type { ReactNode } from 'react'

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)

test('renders search input with correct placeholder', () => {
  render(<SearchPage />, { wrapper })
  expect(screen.getByPlaceholderText(/buscar músicas/i)).toBeInTheDocument()
})
