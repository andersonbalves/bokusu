/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSocketEvent } from './useSocketEvent'
import { socket } from '../lib/socket'

vi.mock('../lib/socket', () => ({
  socket: {
    on: vi.fn(),
    off: vi.fn(),
  }
}))

beforeEach(() => {
  vi.mocked(socket.on).mockClear()
  vi.mocked(socket.off).mockClear()
})

describe('useSocketEvent', () => {
  it('registers a listener on mount and removes the same listener on unmount', () => {
    const callback = vi.fn()
    const { unmount } = renderHook(() => useSocketEvent('myEvent', callback))

    expect(socket.on).toHaveBeenCalledWith('myEvent', expect.any(Function))
    expect(socket.off).not.toHaveBeenCalled()

    const registered = vi.mocked(socket.on).mock.calls.at(-1)![1]
    unmount()

    expect(socket.off).toHaveBeenCalledWith('myEvent', registered)
  })

  it('forwards events to the latest callback after a re-render with a new function', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(
      ({ cb }) => useSocketEvent('e', cb),
      { initialProps: { cb: first } }
    )
    rerender({ cb: second })

    const registered = vi.mocked(socket.on).mock.calls.at(-1)![1]
    registered('payload')

    expect(second).toHaveBeenCalledWith('payload')
    expect(first).not.toHaveBeenCalled()
  })

  it('re-subscribes when eventName changes', () => {
    const { rerender } = renderHook(
      ({ name }) => useSocketEvent(name, () => {}),
      { initialProps: { name: 'one' } }
    )
    expect(vi.mocked(socket.on).mock.calls.some((c) => c[0] === 'one')).toBe(true)

    rerender({ name: 'two' })
    expect(vi.mocked(socket.on).mock.calls.some((c) => c[0] === 'two')).toBe(true)
    expect(vi.mocked(socket.off).mock.calls.some((c) => c[0] === 'one')).toBe(true)
  })
})
