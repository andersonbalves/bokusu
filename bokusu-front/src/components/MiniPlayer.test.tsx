import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MiniPlayer } from './MiniPlayer'
import { useAppStore } from '../store/useAppStore'
import type { ReactNode } from 'react'
import { vi, test, expect, beforeEach, afterEach } from 'vitest'

const nowPlaying = {
  now_playing: 'Bohemian Rhapsody',
  now_playing_user: 'Ana',
  is_paused: false,
  volume: 0.85,
}

function renderWithClient(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(['nowPlaying'], nowPlaying)
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  useAppStore.setState({
    isAdmin: false,
    showAdminModal: false,
    pendingAdminAction: null,
  })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(nowPlaying))))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('shows title and singer when a song plays', () => {
  renderWithClient(<MiniPlayer onExpand={() => {}} />)
  expect(screen.getByText('Bohemian Rhapsody')).toBeInTheDocument()
  expect(screen.getByText('Ana')).toBeInTheDocument()
})

test('renders nothing when idle', () => {
  const qc = new QueryClient()
  qc.setQueryData(['nowPlaying'], { ...nowPlaying, now_playing: null })
  const { container } = render(
    <QueryClientProvider client={qc}>
      <MiniPlayer onExpand={() => {}} />
    </QueryClientProvider>
  )
  expect(container).toBeEmptyDOMElement()
})

test('non-admin skip click opens admin modal and does not fire request', () => {
  const openSpy = vi.spyOn(useAppStore.getState(), 'openAdminModal')
  renderWithClient(<MiniPlayer onExpand={() => {}} />)

  const fetchMock = vi.mocked(globalThis.fetch)
  fetchMock.mockClear()

  fireEvent.click(screen.getByRole('button', { name: /skip|pular/i }))
  expect(openSpy).toHaveBeenCalled()
  expect(fetchMock).not.toHaveBeenCalled()
})

test('non-admin play/pause click opens admin modal and does not fire request', () => {
  const openSpy = vi.spyOn(useAppStore.getState(), 'openAdminModal')
  renderWithClient(<MiniPlayer onExpand={() => {}} />)

  const fetchMock = vi.mocked(globalThis.fetch)
  fetchMock.mockClear()

  fireEvent.click(screen.getByRole('button', { name: /play|tocar|pause|pausar/i }))
  expect(openSpy).toHaveBeenCalled()
  expect(fetchMock).not.toHaveBeenCalled()
})

test('admin buttons click fires mutations directly', async () => {
  useAppStore.setState({ isAdmin: true })
  renderWithClient(<MiniPlayer onExpand={() => {}} />)

  const fetchMock = vi.mocked(globalThis.fetch)
  fetchMock.mockClear()

  // Click skip
  fireEvent.click(screen.getByRole('button', { name: /skip|pular/i }))
  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/player/action',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'skip' }),
      })
    )
  })

  // Click play/pause (currently not paused, so it should trigger pause)
  fetchMock.mockClear()
  fireEvent.click(screen.getByRole('button', { name: /play|tocar|pause|pausar/i }))
  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/player/action',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'pause' }),
      })
    )
  })
})

test('renders lock overlay only when not admin', () => {
  const { rerender } = renderWithClient(<MiniPlayer onExpand={() => {}} />)

  // Under non-admin, lock icons are present in the DOM (we can query them by class or select elements)
  expect(document.querySelector('.lucide-lock')).toBeInTheDocument()

  // Change state to admin
  useAppStore.setState({ isAdmin: true })
  rerender(
    <QueryClientProvider client={new QueryClient()}>
      <MiniPlayer onExpand={() => {}} />
    </QueryClientProvider>
  )

  expect(document.querySelector('.lucide-lock')).not.toBeInTheDocument()
})

test('tapping the body calls onExpand', () => {
  const onExpand = vi.fn()
  renderWithClient(<MiniPlayer onExpand={onExpand} />)
  fireEvent.click(screen.getByText('Bohemian Rhapsody'))
  expect(onExpand).toHaveBeenCalled()
})
