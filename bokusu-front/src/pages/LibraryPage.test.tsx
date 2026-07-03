import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { LibraryPage } from './LibraryPage'
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
  useAppStore.setState({ isAdmin: true })
  fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        files: [
          { path: '/songs/abba.mp4', displayName: 'ABBA - Dancing Queen' },
        ],
        total: 1,
        page: 1,
        perPage: 10,
      })
    )
  )
  globalThis.fetch = fetchMock
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('renders library page title for admins', async () => {
  render(<LibraryPage />, { wrapper })
  expect(await screen.findByText(/gerenciar biblioteca/i)).toBeInTheDocument()
  expect(await screen.findByText('ABBA - Dancing Queen')).toBeInTheDocument()
})

test('redirects non-admin users to settings', () => {
  useAppStore.setState({ isAdmin: false })
  render(<LibraryPage />, { wrapper })
  expect(screen.queryByText(/gerenciar biblioteca/i)).not.toBeInTheDocument()
})
