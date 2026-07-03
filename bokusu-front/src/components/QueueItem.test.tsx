import { render, screen, fireEvent } from '@testing-library/react'
import { QueueItem } from './QueueItem'
import type { QueueItem as QueueItemType } from '../types/api'

const item: QueueItemType = { file: 'next-song.mp4', title: 'Next Song', user: 'Bob', semitones: 0 }

test('renders position number, title, and user', () => {
  render(<QueueItem item={item} position={2} isAdmin={true} onRemove={() => {}} />)
  expect(screen.getByText('Next Song')).toBeInTheDocument()
  expect(screen.getByText('Bob')).toBeInTheDocument()
  expect(screen.getByText('2')).toBeInTheDocument()
})

test('calls onRemove when remove button clicked as admin', () => {
  const onRemove = vi.fn()
  render(<QueueItem item={item} position={2} isAdmin={true} onRemove={onRemove} removeDisabled={false} />)
  fireEvent.click(screen.getByRole('button', { name: /remover/i }))
  expect(onRemove).toHaveBeenCalledTimes(1)
})

test('shows lock badge when not admin', () => {
  render(<QueueItem item={item} position={2} isAdmin={false} onRemove={() => {}} removeDisabled={false} />)
  expect(screen.getByLabelText('admin necessário')).toBeInTheDocument()
})
