import { render, screen, act } from '@testing-library/react'
import { ToastHost } from './ToastHost'
import { useAppStore } from '../store/useAppStore'
import { useSocketEvent } from '../hooks/useSocketEvent'
import { vi, test, expect, beforeEach, afterEach } from 'vitest'

vi.mock('../hooks/useSocketEvent', () => ({
  useSocketEvent: vi.fn(),
}))

beforeEach(() => {
  useAppStore.setState({
    toasts: [],
  })
  vi.mocked(useSocketEvent).mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('renders a toast when pushed to the store', () => {
  render(<ToastHost />)
  expect(screen.queryByText('Hello World')).not.toBeInTheDocument()

  act(() => {
    useAppStore.getState().pushToast('Hello World', 'info')
  })

  expect(screen.getByText('Hello World')).toBeInTheDocument()
})

test('allows manual dismissal', () => {
  render(<ToastHost />)
  act(() => {
    useAppStore.getState().pushToast('Manual Dismiss', 'info')
  })
  expect(screen.getByText('Manual Dismiss')).toBeInTheDocument()

  const dismissBtn = screen.getByRole('button', { name: /fechar/i })
  act(() => {
    dismissBtn.click()
  })

  expect(screen.queryByText('Manual Dismiss')).not.toBeInTheDocument()
})

test('auto-dismisses after 4 seconds', () => {
  vi.useFakeTimers()
  try {
    render(<ToastHost />)
    act(() => {
      useAppStore.getState().pushToast('Auto Dismiss Me', 'info')
    })
    expect(screen.getByText('Auto Dismiss Me')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(screen.queryByText('Auto Dismiss Me')).not.toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})

test('listens to socket events and pushes toasts', () => {
  const socketCallbacks: Record<string, Function> = {}

  vi.mocked(useSocketEvent).mockImplementation((event, callback) => {
    socketCallbacks[event] = callback
  })

  render(<ToastHost />)

  // Verify listeners were registered
  expect(useSocketEvent).toHaveBeenCalledWith('notification', expect.any(Function))
  expect(useSocketEvent).toHaveBeenCalledWith('sync_started', expect.any(Function))
  expect(useSocketEvent).toHaveBeenCalledWith('sync_finished', expect.any(Function))

  // Simulate notification event without color segment
  act(() => {
    socketCallbacks['notification']('Simple Notification')
  })
  expect(screen.getByText('Simple Notification')).toBeInTheDocument()
  expect(useAppStore.getState().toasts[0].severity).toBe('info')

  // Simulate notification event with success color
  act(() => {
    socketCallbacks['notification']('Success message::is-success')
  })
  expect(screen.getByText('Success message')).toBeInTheDocument()
  expect(useAppStore.getState().toasts[1].severity).toBe('success')

  // Simulate notification event with danger color
  act(() => {
    socketCallbacks['notification']('Danger message::is-danger')
  })
  expect(screen.getByText('Danger message')).toBeInTheDocument()
  expect(useAppStore.getState().toasts[2].severity).toBe('danger')

  // Simulate notification event with warning color -> danger
  act(() => {
    socketCallbacks['notification']('Warning message::is-warning')
  })
  expect(screen.getByText('Warning message')).toBeInTheDocument()
  expect(useAppStore.getState().toasts[3].severity).toBe('danger')

  // Simulate notification event with unknown color -> info
  act(() => {
    socketCallbacks['notification']('Unknown color::is-blue')
  })
  expect(screen.getByText('Unknown color')).toBeInTheDocument()
  expect(useAppStore.getState().toasts[4].severity).toBe('info')

  // Simulate sync_started
  act(() => {
    socketCallbacks['sync_started']()
  })
  expect(screen.getByText('Sincronizando biblioteca...')).toBeInTheDocument()

  // Simulate sync_finished
  act(() => {
    socketCallbacks['sync_finished']()
  })
  expect(screen.getByText('Biblioteca sincronizada')).toBeInTheDocument()
})
