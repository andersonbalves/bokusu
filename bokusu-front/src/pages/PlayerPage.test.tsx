import { render, screen } from '@testing-library/react'
import type { NowPlaying, Preferences } from '../types/api'
import { vi } from 'vitest'

const mockNowPlaying: Partial<NowPlaying> = {
  now_playing: null,
  now_playing_url: null,
  now_playing_subtitle_url: null,
  is_paused: false,
  volume: 0.8,
  up_next: null,
  next_user: null,
}
const mockPrefs: Partial<Preferences> = {
  splash_display_mode: 'integration',
  disable_score: false,
  hide_url: false,
  hide_overlay: false,
  hide_notifications: false,
  show_splash_clock: false,
  screensaver_timeout: 0,
  disable_bg_music: true,
  disable_bg_video: true,
  bg_music_volume: 0.5,
}

const nowPlayingState = { data: mockNowPlaying }
const prefsState = { data: mockPrefs }
let connectionInfoState: { data: { url: string; isRaspberryPi: boolean } | undefined } = {
  data: undefined,
}

vi.mock('../hooks/useNowPlaying', () => ({ useNowPlaying: () => nowPlayingState }))
vi.mock('../hooks/usePreferences', () => ({ usePreferences: () => prefsState }))
vi.mock('../hooks/useSystem', () => ({ useConnectionInfo: () => connectionInfoState }))
vi.mock('../hooks/useQueue', () => ({ useQueue: () => ({ data: [] }) }))
vi.mock('../hooks/useScorePhrases', () => ({
  useScorePhrases: () => ({ data: { low: ['a'], mid: ['b'], high: ['c'] } }),
}))
vi.mock('../hooks/useSplashRole', () => ({ useSplashRole: () => 'master' }))
vi.mock('../components/player/IdleScreen', () => ({
  IdleScreen: (props: { isLoading: boolean }) => (
    <div data-testid="idle-screen" data-loading={props.isLoading} />
  ),
}))
vi.mock('../components/player/KaraokePlayer', () => ({
  KaraokePlayer: (props: { url: string; onCanPlay: () => void }) => (
    <button data-testid="karaoke-video" data-url={props.url} onClick={props.onCanPlay} />
  ),
}))
vi.mock('../components/player/ScoreScreen', () => ({
  ScoreScreen: () => <div data-testid="score-screen" />,
}))
vi.mock('../components/player/NotificationBanner', () => ({
  NotificationBanner: () => <div data-testid="tv-notification-host" />,
}))

import { fireEvent } from '@testing-library/react'
import { PlayerPage } from './PlayerPage'

beforeEach(() => {
  nowPlayingState.data = { ...mockNowPlaying }
  prefsState.data = { ...mockPrefs }
  connectionInfoState = { data: undefined }
})

test('renders idle screen when nothing is playing', () => {
  render(<PlayerPage appUrl="http://10.0.0.5:5555" />)
  expect(screen.getByTestId('idle-screen')).toBeTruthy()
  expect(screen.queryByTestId('karaoke-video')).toBeNull()
})

test('mounts KaraokePlayer in loading and shows it after canplay', () => {
  nowPlayingState.data = { ...mockNowPlaying, now_playing_url: '/stream/abc.m3u8' }
  render(<PlayerPage appUrl="http://10.0.0.5:5555" />)
  const video = screen.getByTestId('karaoke-video')
  expect(video.getAttribute('data-url')).toBe('/stream/abc.m3u8')
  // loading: idle screen ainda visível como fundo com spinner
  expect(screen.getByTestId('idle-screen').getAttribute('data-loading')).toBe('true')
  fireEvent.click(video) // dispara onCanPlay
  expect(screen.queryByTestId('idle-screen')).toBeNull()
})

test('playing overlay shows title and up next unless hide_overlay', () => {
  nowPlayingState.data = {
    ...mockNowPlaying,
    now_playing: 'Bohemian Rhapsody',
    now_playing_user: 'Alice',
    now_playing_url: '/stream/abc.m3u8',
    up_next: 'Hotel California',
    next_user: 'Bob',
  }
  render(<PlayerPage appUrl="http://10.0.0.5:5555" />)
  fireEvent.click(screen.getByTestId('karaoke-video'))
  expect(screen.getByText('Bohemian Rhapsody')).toBeTruthy()
  expect(screen.getByText(/Hotel California/)).toBeTruthy()

  prefsState.data = { ...mockPrefs, hide_overlay: true }
  render(<PlayerPage appUrl="http://10.0.0.5:5555" />)
})

test('always renders the notification banner host', () => {
  render(<PlayerPage appUrl="http://10.0.0.5:5555" />)
  expect(screen.getByTestId('tv-notification-host')).toBeTruthy()
})

test('QR code uses the server-reported URL when no appUrl prop is given', () => {
  connectionInfoState = { data: { url: 'http://192.168.0.10:5555', isRaspberryPi: false } }
  nowPlayingState.data = { ...mockNowPlaying, now_playing_url: '/stream/abc.m3u8' }
  render(<PlayerPage />)
  fireEvent.click(screen.getByTestId('karaoke-video'))
  expect(screen.getByText('192.168.0.10:5555')).toBeInTheDocument()
})
