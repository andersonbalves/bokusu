import { renderHook, act } from '@testing-library/react'
import { vi, expect, test, beforeEach, afterEach } from 'vitest'

const emit = vi.fn()
vi.mock('../lib/socket', () => ({
  socket: { emit: (...args: unknown[]) => emit(...args) },
}))

import { usePlayerStateMachine } from './usePlayerStateMachine'

beforeEach(() => {
  emit.mockClear()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

const setup = (initialUrl: string | null = null, disableScore = false, isMaster = true) =>
  renderHook(
    ({ url }: { url: string | null }) =>
      usePlayerStateMachine({ nowPlayingUrl: url, disableScore, isMaster }),
    { initialProps: { url: initialUrl } }
  )

test('starts idle and enters loading on new url', () => {
  const { result, rerender } = setup()
  expect(result.current.state).toBe('idle')
  rerender({ url: '/stream/abc.m3u8' })
  expect(result.current.state).toBe('loading')
  expect(result.current.mediaUrl).toBe('/stream/abc.m3u8')
})

test('canplay moves to playing and emits start_song', () => {
  const { result, rerender } = setup()
  rerender({ url: '/stream/abc.m3u8' })
  act(() => result.current.handleCanPlay())
  expect(result.current.state).toBe('playing')
  expect(emit).toHaveBeenCalledWith('start_song')
})

test('slave never emits', () => {
  const { result, rerender } = setup(null, false, false)
  rerender({ url: '/stream/abc.m3u8' })
  act(() => result.current.handleCanPlay())
  act(() => result.current.handleEnded())
  act(() => result.current.handleScoreFinished())
  expect(emit).not.toHaveBeenCalled()
})

test('ended goes to scoring, scoreFinished emits end_song complete and returns to idle', () => {
  const { result, rerender } = setup()
  rerender({ url: '/stream/abc.m3u8' })
  act(() => result.current.handleCanPlay())
  act(() => result.current.handleEnded())
  expect(result.current.state).toBe('scoring')
  expect(emit).not.toHaveBeenCalledWith('end_song', expect.anything())
  act(() => result.current.handleScoreFinished())
  expect(emit).toHaveBeenCalledWith('end_song', 'complete')
  expect(result.current.state).toBe('idle')
})

test('ended with score disabled emits end_song complete directly', () => {
  const { result, rerender } = setup(null, true)
  rerender({ url: '/stream/abc.m3u8' })
  act(() => result.current.handleCanPlay())
  act(() => result.current.handleEnded())
  expect(emit).toHaveBeenCalledWith('end_song', 'complete')
  expect(result.current.state).toBe('idle')
})

test('error emits end_song error and returns to idle', () => {
  const { result, rerender } = setup()
  rerender({ url: '/stream/abc.m3u8' })
  act(() => result.current.handleCanPlay())
  act(() => result.current.handleError())
  expect(emit).toHaveBeenCalledWith('end_song', 'error')
  expect(result.current.state).toBe('idle')
})

test('loading timeout emits end_song error', () => {
  const { result, rerender } = setup()
  rerender({ url: '/stream/abc.m3u8' })
  act(() => vi.advanceTimersByTime(10_000))
  expect(emit).toHaveBeenCalledWith('end_song', 'error')
  expect(result.current.state).toBe('idle')
})

test('server-side skip (url null while playing) goes idle without emitting end_song', () => {
  const { result, rerender } = setup()
  rerender({ url: '/stream/abc.m3u8' })
  act(() => result.current.handleCanPlay())
  emit.mockClear()
  rerender({ url: null })
  expect(result.current.state).toBe('idle')
  expect(emit).not.toHaveBeenCalled()
})

test('url null during scoring does not cut the score', () => {
  const { result, rerender } = setup()
  rerender({ url: '/stream/abc.m3u8' })
  act(() => result.current.handleCanPlay())
  act(() => result.current.handleEnded())
  rerender({ url: null })
  expect(result.current.state).toBe('scoring')
})

test('new url during scoring cancels score and loads new media', () => {
  const { result, rerender } = setup()
  rerender({ url: '/stream/abc.m3u8' })
  act(() => result.current.handleCanPlay())
  act(() => result.current.handleEnded())
  rerender({ url: '/stream/next.m3u8' })
  expect(result.current.state).toBe('loading')
  expect(result.current.mediaUrl).toBe('/stream/next.m3u8')
})

test('stale callbacks are ignored outside their state', () => {
  const { result } = setup()
  act(() => result.current.handleEnded())
  act(() => result.current.handleScoreFinished())
  expect(result.current.state).toBe('idle')
  expect(emit).not.toHaveBeenCalled()
})

test('does not re-enter loading for the same url after the song ends', () => {
  // Após end_song o servidor demora alguns ms para zerar o now_playing;
  // a URL antiga ainda presente não pode recomeçar a música
  const { result, rerender } = setup(null, true)
  rerender({ url: '/stream/abc.m3u8' })
  act(() => result.current.handleCanPlay())
  act(() => result.current.handleEnded()) // disableScore: end_song direto + idle
  rerender({ url: '/stream/abc.m3u8' }) // rerender com a URL antiga ainda não limpa
  expect(result.current.state).toBe('idle')
})
