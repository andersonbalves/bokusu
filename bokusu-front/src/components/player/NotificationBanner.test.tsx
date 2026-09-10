import { render, act, screen } from '@testing-library/react'
import { vi, test, expect, beforeEach, afterEach } from 'vitest'

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

import { NotificationBanner } from './NotificationBanner'

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

test('shows notification with severity and master clears it on the server', () => {
  render(<NotificationBanner isMaster={true} hideNotifications={false} />)
  act(() => socketHandlers['notification']('Pulando música::is-danger'))
  const banner = screen.getByTestId('tv-notification')
  expect(banner.textContent).toContain('Pulando música')
  expect(banner.className).toContain('alert-error')
  expect(emit).toHaveBeenCalledWith('clear_notification')
})

test('slave does not emit clear_notification', () => {
  render(<NotificationBanner isMaster={false} hideNotifications={false} />)
  act(() => socketHandlers['notification']('Oi::is-info'))
  expect(emit).not.toHaveBeenCalled()
})

test('auto-dismisses after 8s', () => {
  render(<NotificationBanner isMaster={true} hideNotifications={false} />)
  act(() => socketHandlers['notification']('Oi::is-info'))
  expect(screen.getByTestId('tv-notification')).toBeTruthy()
  act(() => vi.advanceTimersByTime(8000))
  expect(screen.queryByTestId('tv-notification')).toBeNull()
})

test('hideNotifications suppresses rendering', () => {
  render(<NotificationBanner isMaster={true} hideNotifications={true} />)
  act(() => socketHandlers['notification']('Oi::is-info'))
  expect(screen.queryByTestId('tv-notification')).toBeNull()
})
