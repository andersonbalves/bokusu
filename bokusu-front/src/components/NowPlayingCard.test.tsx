import { render, screen, fireEvent } from '@testing-library/react'
import { NowPlayingCard } from './NowPlayingCard'
import type { NowPlaying } from '../types/api'

const nowPlaying: NowPlaying = {
  now_playing: 'Test Song',
  now_playing_user: 'Alice',
  now_playing_duration: 200,
  now_playing_transpose: 0,
  now_playing_url: '/stream/test',
  now_playing_subtitle_url: null,
  now_playing_position: 10,
  is_paused: false,
  up_next: null,
  next_user: null,
  volume: 0.8,
}

test('renders song title and singer name', () => {
  render(<NowPlayingCard nowPlaying={nowPlaying} onSkip={() => {}} canSkip={true} />)
  expect(screen.getByText('Test Song')).toBeInTheDocument()
  expect(screen.getByText('Alice')).toBeInTheDocument()
})

test('skip button is visible', () => {
  render(<NowPlayingCard nowPlaying={nowPlaying} onSkip={() => {}} canSkip={true} />)
  expect(screen.getByRole('button', { name: /pular/i })).toBeInTheDocument()
})

test('skip button calls onSkip when clicked', () => {
  const onSkip = vi.fn()
  render(<NowPlayingCard nowPlaying={nowPlaying} onSkip={onSkip} canSkip={true} />)
  fireEvent.click(screen.getByRole('button', { name: /pular/i }))
  expect(onSkip).toHaveBeenCalledTimes(1)
})

test('lock icon visible when canSkip is false', () => {
  render(<NowPlayingCard nowPlaying={nowPlaying} onSkip={() => {}} canSkip={false} />)
  expect(screen.getByLabelText('admin necessário')).toBeInTheDocument()
})
