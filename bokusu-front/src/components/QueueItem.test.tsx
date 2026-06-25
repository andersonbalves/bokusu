import { render, screen, fireEvent } from '@testing-library/react'
import { QueueItem } from './QueueItem'
import type { Song } from '../types/api'

const song: Song = { id: '2', title: 'Next Song', singerName: 'Bob', position: 1 }

test('renders position number, title, and singer', () => {
  render(<QueueItem song={song} isAdmin={true} onRemove={() => {}} />)
  expect(screen.getByText('Next Song')).toBeInTheDocument()
  expect(screen.getByText('Bob')).toBeInTheDocument()
  expect(screen.getByText('2')).toBeInTheDocument()
})

test('calls onRemove when remove button clicked as admin', () => {
  const onRemove = vi.fn()
  render(<QueueItem song={song} isAdmin={true} onRemove={onRemove} removeDisabled={false} />)
  fireEvent.click(screen.getByRole('button', { name: /remover/i }))
  expect(onRemove).toHaveBeenCalledTimes(1)
})

test('shows lock badge when not admin', () => {
  render(<QueueItem song={song} isAdmin={false} onRemove={() => {}} removeDisabled={false} />)
  expect(screen.getByLabelText('admin necessário')).toBeInTheDocument()
})
