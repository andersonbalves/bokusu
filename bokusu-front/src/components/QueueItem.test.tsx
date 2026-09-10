import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { QueueItem } from './QueueItem'
import { useAppStore } from '../store/useAppStore'
import type { QueueItem as QueueItemType } from '../types/api'
import { vi, test, expect, beforeEach, afterEach } from 'vitest'

const item: QueueItemType = { file: 'next-song.mp4', title: 'Next Song', user: 'Bob', semitones: 0 }

function renderItem(isAdmin = true, isDownloading = false) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  useAppStore.setState({ isAdmin })
  return render(
    <QueryClientProvider client={qc}>
      <QueueItem
        item={item}
        position={2}
        isAdmin={isAdmin}
        isDownloading={isDownloading}
      />
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

test('renders position number, title, and user', () => {
  renderItem(true)
  expect(screen.getByText('Next Song')).toBeInTheDocument()
  expect(screen.getByText('Bob')).toBeInTheDocument()
  expect(screen.getByText('2')).toBeInTheDocument()
})

test('shows lock badge when not admin', () => {
  renderItem(false)
  expect(screen.getByLabelText('admin necessário')).toBeInTheDocument()
})

test('shows loading spinner instead of grab handle when downloading', () => {
  renderItem(true, true)
  expect(screen.queryByLabelText('Drag handle')).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/options|opções/i)).not.toBeInTheDocument()
})
