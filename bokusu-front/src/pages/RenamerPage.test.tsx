import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { RenamerPage } from './RenamerPage'
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
        songs: [
          { file: '/songs/abba.mp4', currentName: 'abba', suggestedName: 'ABBA - Dancing Queen', isEqual: false },
        ],
        total: 1,
        page: 1,
      })
    )
  )
  globalThis.fetch = fetchMock
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('renders renamer page title and song suggestion list', async () => {
  render(<RenamerPage />, { wrapper })
  expect(await screen.findByText(/renomeador inteligente/i)).toBeInTheDocument()
  expect(await screen.findByText('abba')).toBeInTheDocument()
  expect(await screen.findByText('ABBA - Dancing Queen')).toBeInTheDocument()
})

test('applies selection to rename-file mutation', async () => {
  render(<RenamerPage />, { wrapper })

  // O checkbox do item na linha
  const checkbox = await screen.findByLabelText('Select abba')
  fireEvent.click(checkbox)

  // Clica no botão de aplicar
  const applyButton = await screen.findByRole('button', { name: /aplicar/i })
  fireEvent.click(applyButton)

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/renamer/rename',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ old_name: '/songs/abba.mp4', new_name: 'ABBA - Dancing Queen' }),
      })
    )
  })
})
