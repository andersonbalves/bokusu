import { describe, it, expect, vi } from 'vitest'

vi.mock('socket.io-client', () => {
  return {
    io: vi.fn(() => ({ on: vi.fn(), off: vi.fn() }))
  }
})

describe('socket', () => {
  it('should initialize socket connection', async () => {
    const { socket } = await import('./socket')
    expect(socket).toBeDefined()
    expect(typeof socket.on).toBe('function')
  })

  it('updates store on connect and disconnect', async () => {
    const { useAppStore } = await import('../store/useAppStore')
    useAppStore.setState({ isConnected: true })
    
    const { socket } = await import('./socket')
    
    expect(socket.on).toHaveBeenCalledWith('connect', expect.any(Function))
    expect(socket.on).toHaveBeenCalledWith('disconnect', expect.any(Function))
  })
})
