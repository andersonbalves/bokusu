/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSocketEvent } from './useSocketEvent'
import { socket } from '../lib/socket'

vi.mock('../lib/socket', () => ({
  socket: {
    on: vi.fn(),
    off: vi.fn(),
  }
}))

describe('useSocketEvent', () => {
  it('registers and cleans up socket event listener', () => {
    const callback = vi.fn()
    const { unmount } = renderHook(() => useSocketEvent('myEvent', callback))
    
    expect(socket.on).toHaveBeenCalledWith('myEvent', callback)
    expect(socket.off).not.toHaveBeenCalled()
    
    unmount()
    
    expect(socket.off).toHaveBeenCalledWith('myEvent', callback)
  })
})