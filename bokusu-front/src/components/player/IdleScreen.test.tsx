import { render, act, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { IdleScreen } from './IdleScreen'
import { vi } from 'vitest'

vi.mock('./BackgroundMedia', () => ({ BackgroundMedia: () => null }))

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const baseProps = {
  appUrl: 'http://10.0.0.5:5555',
  mode: 'integration' as const,
  upcoming: [],
  hideUrl: false,
  showClock: true,
  screensaverTimeout: 30,
  disableBgMusic: true,
  disableBgVideo: true,
  bgMusicVolume: 0.5,
  isLoading: false,
}

test('integration mode: renders QR code and welcome message', () => {
  render(<IdleScreen {...baseProps} mode="integration" />, { wrapper })
  expect(screen.getByTestId('qr-code')).toBeInTheDocument()
  expect(screen.getByText(/escaneie para cantar/i)).toBeInTheDocument()
})

test('integration mode: renders host below QR', () => {
  render(<IdleScreen {...baseProps} mode="integration" />, { wrapper })
  expect(screen.getByText('10.0.0.5:5555')).toBeInTheDocument()
})

test('cinematic mode: renders QR in corner and IP address', () => {
  render(<IdleScreen {...baseProps} mode="cinematic" />, { wrapper })
  expect(screen.getByTestId('qr-code')).toBeInTheDocument()
  expect(screen.getByText('10.0.0.5:5555')).toBeInTheDocument()
})

test('cinematic mode: does not render welcome message', () => {
  render(<IdleScreen {...baseProps} mode="cinematic" />, { wrapper })
  expect(screen.queryByText(/escaneie para cantar/i)).not.toBeInTheDocument()
})

test('shows QR code and host in integration mode', () => {
  render(<IdleScreen {...baseProps} />, { wrapper })
  expect(screen.getByTestId('qr-code')).toBeTruthy()
  expect(screen.getByText('10.0.0.5:5555')).toBeTruthy()
})

test('hideUrl hides the QR code', () => {
  render(<IdleScreen {...baseProps} hideUrl={true} />, { wrapper })
  expect(screen.queryByTestId('qr-code')).toBeNull()
})

test('shows clock when showClock', () => {
  render(<IdleScreen {...baseProps} />, { wrapper })
  expect(screen.getByTestId('splash-clock')).toBeTruthy()
})

test('screensaver appears after timeout and clears on prop change', () => {
  vi.useFakeTimers()
  const { rerender } = render(<IdleScreen {...baseProps} />, { wrapper })
  expect(screen.queryByTestId('screensaver')).toBeNull()
  act(() => { vi.advanceTimersByTime(30_000) })
  expect(screen.getByTestId('screensaver')).toBeTruthy()
  rerender(
    <IdleScreen
      {...baseProps}
      upcoming={[{ user: 'Alice', file: 'a.mp4', title: 'Song', semitones: 0 }]}
    />
  )
  expect(screen.queryByTestId('screensaver')).toBeNull()
  vi.useRealTimers()
})

test('screensaverTimeout 0 disables the screensaver', () => {
  vi.useFakeTimers()
  render(<IdleScreen {...baseProps} screensaverTimeout={0} />, { wrapper })
  act(() => { vi.advanceTimersByTime(120_000) })
  expect(screen.queryByTestId('screensaver')).toBeNull()
  vi.useRealTimers()
})

test('isLoading shows a loading indicator', () => {
  render(<IdleScreen {...baseProps} isLoading={true} />, { wrapper })
  expect(screen.getByTestId('player-loading')).toBeTruthy()
})
