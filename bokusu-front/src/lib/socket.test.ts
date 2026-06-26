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
})