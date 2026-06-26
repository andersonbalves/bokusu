import { describe, it, expect, vi } from 'vitest'

const { onMock, offMock } = vi.hoisted(() => ({
  onMock: vi.fn(),
  offMock: vi.fn(),
}))

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({ on: onMock, off: offMock })),
}))

describe('socket', () => {
  it('should initialize socket connection', async () => {
    const { socket } = await import('./socket')
    expect(socket).toBeDefined()
    expect(typeof socket.on).toBe('function')
  })

  it('updates store on connect and disconnect', async () => {
    const { useAppStore } = await import('../store/useAppStore')
    useAppStore.setState({ isConnected: true })
    await import('./socket')

    const connectHandler = onMock.mock.calls.find((c) => c[0] === 'connect')?.[1]
    const disconnectHandler = onMock.mock.calls.find((c) => c[0] === 'disconnect')?.[1]

    expect(connectHandler).toBeTypeOf('function')
    expect(disconnectHandler).toBeTypeOf('function')

    disconnectHandler!()
    expect(useAppStore.getState().isConnected).toBe(false)

    connectHandler!()
    expect(useAppStore.getState().isConnected).toBe(true)
  })
})