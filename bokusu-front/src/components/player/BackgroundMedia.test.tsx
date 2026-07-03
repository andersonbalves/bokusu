import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { BackgroundMedia } from './BackgroundMedia'
import { vi } from 'vitest'

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  window.HTMLMediaElement.prototype.pause = vi.fn()
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(['/bg_music/a.mp3', '/bg_music/b.mp3']),
  } as any)
})
afterEach(() => vi.unstubAllGlobals())

const baseProps = {
  active: true,
  disableBgMusic: false,
  disableBgVideo: false,
  bgMusicVolume: 0.5,
}

test('plays bg music from /bg_playlist when active', async () => {
  const { getByTestId } = render(<BackgroundMedia {...baseProps} />, { wrapper })
  const audio = getByTestId('bg-music') as HTMLAudioElement
  await waitFor(() => expect(audio.src).toContain('/bg_music/a.mp3'))
  expect(audio.play).toHaveBeenCalled()
  expect(audio.volume).toBe(0.5)
})

test('pauses bg music when inactive', async () => {
  const { getByTestId, rerender } = render(<BackgroundMedia {...baseProps} />, { wrapper })
  rerender(<BackgroundMedia {...baseProps} active={false} />)
  const audio = getByTestId('bg-music') as HTMLAudioElement
  await waitFor(() => expect(audio.pause).toHaveBeenCalled())
})

test('does not play when disableBgMusic', async () => {
  const { getByTestId } = render(
    <BackgroundMedia {...baseProps} disableBgMusic={true} />,
    { wrapper }
  )
  const audio = getByTestId('bg-music') as HTMLAudioElement
  await waitFor(() => expect(fetch).toHaveBeenCalled())
  expect(audio.play).not.toHaveBeenCalled()
})

test('renders bg video loop unless disabled', () => {
  const { getByTestId, rerender, queryByTestId } = render(
    <BackgroundMedia {...baseProps} />,
    { wrapper }
  )
  expect(getByTestId('bg-video')).toBeTruthy()
  rerender(<BackgroundMedia {...baseProps} disableBgVideo={true} />)
  expect(queryByTestId('bg-video')).toBeNull()
})
