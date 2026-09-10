import { render, fireEvent } from '@testing-library/react'

const hlsInstance = {
  loadSource: vi.fn(),
  attachMedia: vi.fn(),
  destroy: vi.fn(),
  startLoad: vi.fn(),
  recoverMediaError: vi.fn(),
  on: vi.fn(),
}
vi.mock('hls.js', () => ({
  default: Object.assign(
    vi.fn().mockImplementation(function() { return hlsInstance }),
    {
      Events: { ERROR: 'hlsError' },
      ErrorTypes: { NETWORK_ERROR: 'networkError', MEDIA_ERROR: 'mediaError', OTHER_ERROR: 'otherError' },
    }
  )
}))
vi.mock('libass-wasm', () => ({
  default: vi.fn().mockImplementation(function() { return { dispose: vi.fn() } }),
}))
const socketHandlers: Record<string, (...args: unknown[]) => void> = {}
vi.mock('../../hooks/useSocketEvent', () => ({
  useSocketEvent: (event: string, cb: (...args: unknown[]) => void) => {
    socketHandlers[event] = cb
  },
}))
const emit = vi.fn()
vi.mock('../../lib/socket', () => ({
  socket: { emit: (...args: unknown[]) => emit(...args) },
}))

import Hls from 'hls.js'
import SubtitlesOctopus from 'libass-wasm'
import { KaraokePlayer } from './KaraokePlayer'
import { vi } from 'vitest'

vi.mock('libass-wasm/dist/js/subtitles-octopus-worker.js?url', () => ({ default: '/worker.js' }))
vi.mock('../../assets/fonts/Arial.ttf?url', () => ({ default: '/Arial.ttf' }))
vi.mock('../../assets/fonts/DroidSansFallback.ttf?url', () => ({ default: '/DroidSansFallback.ttf' }))

beforeEach(() => {
  vi.clearAllMocks()
  // jsdom não implementa play/pause de mídia
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  window.HTMLMediaElement.prototype.pause = vi.fn()
  window.HTMLMediaElement.prototype.load = vi.fn()
})

const baseProps = {
  url: '/stream/abc.mp4',
  subtitleUrl: null,
  isPaused: false,
  volume: 0.8,
  isMaster: true,
  onCanPlay: vi.fn(),
  onEnded: vi.fn(),
  onError: vi.fn(),
}

function getHlsErrorHandler(): (event: string, data: { fatal: boolean; type: string }) => void {
  const call = hlsInstance.on.mock.calls.find(([event]) => event === 'hlsError')
  if (!call) throw new Error('hls ERROR handler not registered')
  return call[1] as (event: string, data: { fatal: boolean; type: string }) => void
}

function renderHlsPlayer(overrides: Partial<typeof baseProps> = {}) {
  window.HTMLMediaElement.prototype.canPlayType = vi.fn().mockReturnValue('')
  return render(<KaraokePlayer {...baseProps} {...overrides} url="/stream/abc.m3u8" />)
}

test('mp4 url is set directly as video src', () => {
  const { getByTestId } = render(<KaraokePlayer {...baseProps} />)
  const video = getByTestId('karaoke-video') as HTMLVideoElement
  expect(video.src).toContain('/stream/abc.mp4')
  expect(Hls).not.toHaveBeenCalled()
})

test('m3u8 url without native support goes through hls.js', () => {
  window.HTMLMediaElement.prototype.canPlayType = vi.fn().mockReturnValue('')
  render(<KaraokePlayer {...baseProps} url="/stream/abc.m3u8" />)
  expect(Hls).toHaveBeenCalled()
  expect(hlsInstance.loadSource).toHaveBeenCalledWith('/stream/abc.m3u8')
  expect(hlsInstance.attachMedia).toHaveBeenCalled()
})

test('subtitleUrl instantiates SubtitlesOctopus', () => {
  render(<KaraokePlayer {...baseProps} subtitleUrl="/subtitle/abc" />)
  expect(SubtitlesOctopus).toHaveBeenCalledWith(
    expect.objectContaining({ subUrl: '/subtitle/abc' })
  )
})

test('isPaused pauses the media element', () => {
  const { rerender, getByTestId } = render(<KaraokePlayer {...baseProps} />)
  rerender(<KaraokePlayer {...baseProps} isPaused={true} />)
  const video = getByTestId('karaoke-video') as HTMLVideoElement
  expect(video.pause).toHaveBeenCalled()
})

test('volume prop is applied to the media element', () => {
  const { getByTestId } = render(<KaraokePlayer {...baseProps} volume={0.3} />)
  const video = getByTestId('karaoke-video') as HTMLVideoElement
  expect(video.volume).toBe(0.3)
})

test('media events call the state machine callbacks', () => {
  const { getByTestId } = render(<KaraokePlayer {...baseProps} />)
  const video = getByTestId('karaoke-video')
  fireEvent(video, new Event('canplay'))
  fireEvent(video, new Event('ended'))
  fireEvent(video, new Event('error'))
  expect(baseProps.onCanPlay).toHaveBeenCalled()
  expect(baseProps.onEnded).toHaveBeenCalled()
  expect(baseProps.onError).toHaveBeenCalled()
})

test('restart socket event seeks to 0', () => {
  const { getByTestId } = render(<KaraokePlayer {...baseProps} />)
  const video = getByTestId('karaoke-video') as HTMLVideoElement
  video.currentTime = 42
  socketHandlers['restart']()
  expect(video.currentTime).toBe(0)
})

test('slave syncs position on playback_position drift > 2s', () => {
  const { getByTestId } = render(<KaraokePlayer {...baseProps} isMaster={false} />)
  const video = getByTestId('karaoke-video') as HTMLVideoElement
  video.currentTime = 10
  socketHandlers['playback_position'](20)
  expect(video.currentTime).toBe(20)
})

test('master ignores playback_position events', () => {
  const { getByTestId } = render(<KaraokePlayer {...baseProps} />)
  const video = getByTestId('karaoke-video') as HTMLVideoElement
  video.currentTime = 10
  socketHandlers['playback_position'](20)
  expect(video.currentTime).toBe(10)
})

test('fatal media error triggers recoverMediaError, not onError', () => {
  const onError = vi.fn()
  renderHlsPlayer({ onError })
  getHlsErrorHandler()('hlsError', { fatal: true, type: 'mediaError' })
  expect(hlsInstance.recoverMediaError).toHaveBeenCalledTimes(1)
  expect(onError).not.toHaveBeenCalled()
})

test('fatal network error triggers startLoad, not onError', () => {
  const onError = vi.fn()
  renderHlsPlayer({ onError })
  getHlsErrorHandler()('hlsError', { fatal: true, type: 'networkError' })
  expect(hlsInstance.startLoad).toHaveBeenCalledTimes(1)
  expect(onError).not.toHaveBeenCalled()
})

test('onError fires after media recovery attempts are exhausted', () => {
  const onError = vi.fn()
  renderHlsPlayer({ onError })
  const fire = () => getHlsErrorHandler()('hlsError', { fatal: true, type: 'mediaError' })
  fire()
  fire()
  fire() // 3rd fatal media error: attempts (2) exhausted
  expect(hlsInstance.recoverMediaError).toHaveBeenCalledTimes(2)
  expect(onError).toHaveBeenCalledTimes(1)
})

test('fatal error of unknown type calls onError immediately', () => {
  const onError = vi.fn()
  renderHlsPlayer({ onError })
  getHlsErrorHandler()('hlsError', { fatal: true, type: 'otherError' })
  expect(onError).toHaveBeenCalledTimes(1)
})

test('non-fatal error is ignored', () => {
  const onError = vi.fn()
  renderHlsPlayer({ onError })
  getHlsErrorHandler()('hlsError', { fatal: false, type: 'networkError' })
  expect(onError).not.toHaveBeenCalled()
})

test('native video error is ignored while hls.js is attached', () => {
  const onError = vi.fn()
  const { getByTestId } = renderHlsPlayer({ onError })
  fireEvent.error(getByTestId('karaoke-video'))
  expect(onError).not.toHaveBeenCalled()
})

test('native video error still reaches onError for direct src playback', () => {
  const onError = vi.fn()
  window.HTMLMediaElement.prototype.canPlayType = vi.fn().mockReturnValue('probably')
  const { getByTestId } = render(<KaraokePlayer {...baseProps} onError={onError} url="/stream/abc.mp4" />)
  fireEvent.error(getByTestId('karaoke-video'))
  expect(onError).toHaveBeenCalledTimes(1)
})
