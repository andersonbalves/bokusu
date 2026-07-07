import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import type { SearchResult } from '../types/api'
import type { AutocompleteResult } from '../hooks/useSearch'

const searchState: { data: SearchResult[]; isFetching: boolean } = {
  data: [],
  isFetching: false,
}
const autocompleteState: { data: AutocompleteResult[] } = { data: [] }
const enqueueMutate = vi.fn()
const startDownloadMutate = vi.fn()

vi.mock('../hooks/useSearch', () => ({ useSearch: () => searchState }))
vi.mock('../hooks/useAutocomplete', () => ({ useAutocomplete: () => autocompleteState }))
vi.mock('../hooks/useDownloads', () => ({
  useStartDownload: () => ({ mutate: startDownloadMutate }),
}))
vi.mock('../hooks/useQueue', () => ({ useEnqueue: () => ({ mutate: enqueueMutate }) }))

import { SearchPage } from './SearchPage'

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)

beforeEach(() => {
  searchState.data = []
  searchState.isFetching = false
  autocompleteState.data = []
  enqueueMutate.mockClear()
  startDownloadMutate.mockClear()
})

test('renders search input with correct placeholder', () => {
  render(<SearchPage />, { wrapper })
  expect(screen.getByPlaceholderText(/buscar músicas/i)).toBeInTheDocument()
})

test('local suggestion row enqueues the local file directly', async () => {
  autocompleteState.data = [
    { path: '/songs/Tempo Perdido---abc12345678.mp4', fileName: 'Tempo Perdido', type: 'autocomplete' },
  ]
  render(<SearchPage />, { wrapper })
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'tempo' } })
  const addButton = await screen.findByRole('button', { name: /adicionar à fila|add to queue/i })
  fireEvent.click(addButton)
  expect(enqueueMutate).toHaveBeenCalledWith(
    { song_id: '/songs/Tempo Perdido---abc12345678.mp4', user: 'Guest' },
    expect.anything()
  )
})
