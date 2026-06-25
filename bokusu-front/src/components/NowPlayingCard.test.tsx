import { render, screen, fireEvent } from '@testing-library/react'
import { NowPlayingCard } from './NowPlayingCard'
import type { Song } from '../types/api'

const song: Song = { id: '1', title: 'Test Song', singerName: 'Alice', position: 0 }

test('renders song title and singer name', () => {
  render(<NowPlayingCard song={song} onSkip={() => {}} canSkip={true} />)
  expect(screen.getByText('Test Song')).toBeInTheDocument()
  expect(screen.getByText('Alice')).toBeInTheDocument()
})

test('skip button is visible', () => {
  render(<NowPlayingCard song={song} onSkip={() => {}} canSkip={true} />)
  expect(screen.getByRole('button', { name: /pular/i })).toBeInTheDocument()
})

test('skip button calls onSkip when clicked', () => {
  const onSkip = vi.fn()
  render(<NowPlayingCard song={song} onSkip={onSkip} canSkip={true} />)
  fireEvent.click(screen.getByRole('button', { name: /pular/i }))
  expect(onSkip).toHaveBeenCalledTimes(1)
})

test('lock icon visible when canSkip is false', () => {
  render(<NowPlayingCard song={song} onSkip={() => {}} canSkip={false} />)
  expect(screen.getByLabelText('admin necessário')).toBeInTheDocument()
})
