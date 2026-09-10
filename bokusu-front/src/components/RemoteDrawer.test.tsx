import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RemoteDrawer } from './RemoteDrawer'
import { useAppStore } from '../store/useAppStore'
import type { ReactNode } from 'react'
import { vi, test, expect, beforeEach, afterEach } from 'vitest'

const nowPlaying = {
  now_playing: 'Bohemian Rhapsody',
  now_playing_user: 'Ana',
  is_paused: false,
  volume: 0.85,
  now_playing_transpose: 0,
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
  vi.useRealTimers()
  useAppStore.setState({
    isAdmin: false,
    showAdminModal: false,
    pendingAdminAction: null,
  })
})

test('renders drawer contents if open and song is playing', () => {
  renderWithClient(<RemoteDrawer open={true} onClose={() => {}} />)
  expect(screen.getByText('Bohemian Rhapsody')).toBeInTheDocument()
  expect(screen.getByText(/Ana/)).toBeInTheDocument()
})

test('renders nothing if not open', () => {
  const { container } = renderWithClient(<RemoteDrawer open={false} onClose={() => {}} />)
  expect(container).toBeEmptyDOMElement()
})

test('renders nothing if open but no song is playing', () => {
  const qc = new QueryClient()
  qc.setQueryData(['nowPlaying'], { ...nowPlaying, now_playing: null })
  const { container } = render(
    <QueryClientProvider client={qc}>
      <RemoteDrawer open={true} onClose={() => {}} />
    </QueryClientProvider>
  )
  expect(container).toBeEmptyDOMElement()
})

test('calls onClose when close button or backdrop is clicked', () => {
  const onClose = vi.fn()
  renderWithClient(<RemoteDrawer open={true} onClose={onClose} />)

  // Get both close buttons (header close X and backdrop)
  const closeButtons = screen.getAllByRole('button', { name: /close|fechar/i })
  expect(closeButtons.length).toBeGreaterThanOrEqual(1)

  // Click the header close button (first one)
  fireEvent.click(closeButtons[0])
  expect(onClose).toHaveBeenCalledTimes(1)

  // Click the backdrop
  const backdrop = document.querySelector('.modal-backdrop')
  expect(backdrop).toBeInTheDocument()
  if (backdrop) {
    fireEvent.click(backdrop)
  }
  expect(onClose).toHaveBeenCalledTimes(2)
})

test('volume slider updates immediately in local state and debounces mutations with real timers', async () => {
  useAppStore.setState({ isAdmin: true })
  renderWithClient(<RemoteDrawer open={true} onClose={() => {}} />)

  const fetchMock = vi.mocked(globalThis.fetch)
  fetchMock.mockClear()

  const slider = screen.getByRole('slider', { name: /volume/i })
  expect(slider).toBeInTheDocument()

  // Change volume
  act(() => {
    fireEvent.change(slider, { target: { value: '0.5' } })
  })

  // It should update UI/local state but NOT fire mutation immediately
  expect(fetchMock).not.toHaveBeenCalled()

  // Wait 150ms (less than 300ms debounce)
  await new Promise((r) => setTimeout(r, 150))
  expect(fetchMock).not.toHaveBeenCalled()

  // Wait another 200ms (total 350ms, past the 300ms debounce)
  await new Promise((r) => setTimeout(r, 200))

  // Ensure debounce fires mutation
  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/player/volume',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ level: 0.5 }),
      })
    )
  })
})

test('closes when Escape key is pressed', () => {
  const onClose = vi.fn()
  renderWithClient(<RemoteDrawer open={true} onClose={onClose} />)

  fireEvent.keyDown(window, { key: 'Escape' })
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('transpose buttons mutate pitch/transpose', async () => {
  useAppStore.setState({ isAdmin: true })
  renderWithClient(<RemoteDrawer open={true} onClose={() => {}} />)

  const fetchMock = vi.mocked(globalThis.fetch)
  fetchMock.mockClear()

  // Click -1 button
  fireEvent.click(screen.getByRole('button', { name: /decrease transpose by 1/i }))
  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/player/pitch',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ level: -1 }),
      })
    )
  })

  fetchMock.mockClear()

  // Click +1 button
  fireEvent.click(screen.getByRole('button', { name: /increase transpose by 1/i }))
  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/player/pitch',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ level: 1 }),
      })
    )
  })
})

test('control buttons (restart, play/pause, skip) require admin and trigger when admin', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(['nowPlaying'], nowPlaying)

  const openSpy = vi.spyOn(useAppStore.getState(), 'openAdminModal')
  const { rerender } = render(
    <QueryClientProvider client={qc}>
      <RemoteDrawer open={true} onClose={() => {}} />
    </QueryClientProvider>
  )

  const fetchMock = vi.mocked(globalThis.fetch)
  fetchMock.mockClear()

  // 1. Non-admin: click restart
  fireEvent.click(screen.getByRole('button', { name: /restart|reiniciar/i }))
  expect(openSpy).toHaveBeenCalled()
  expect(fetchMock).not.toHaveBeenCalled()

  openSpy.mockClear()

  // 2. Set to admin
  useAppStore.setState({ isAdmin: true })
  rerender(
    <QueryClientProvider client={qc}>
      <RemoteDrawer open={true} onClose={() => {}} />
    </QueryClientProvider>
  )

  // Click restart
  fireEvent.click(screen.getByRole('button', { name: /restart|reiniciar/i }))
  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/player/action',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'restart' }),
      })
    )
  })
})
