import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { QueueActionsMenu } from './QueueActionsMenu'
import { useAppStore } from '../store/useAppStore'
import { vi, it, expect, beforeEach, afterEach } from 'vitest'

function renderMenu() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  useAppStore.setState({ isAdmin: true })
  return render(
    <QueryClientProvider client={qc}>
      <QueueActionsMenu song="/x/a.mp4" />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })))
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('"play next" PATCHes item to top', async () => {
  renderMenu()
  fireEvent.click(screen.getByRole('button', { name: /options|opções/i }))
  fireEvent.click(screen.getByText(/play next|tocar a seguir/i))
  await waitFor(() =>
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/queue/item',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ song: '/x/a.mp4', action: 'top' }),
      })
    )
  )
})

it('"delete" DELETEs item', async () => {
  renderMenu()
  fireEvent.click(screen.getByRole('button', { name: /options|opções/i }))
  fireEvent.click(screen.getByText(/delete|apagar/i))
  await waitFor(() =>
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/api/queue/item?song='),
      expect.objectContaining({ method: 'DELETE' })
    )
  )
})
