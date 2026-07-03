import { render, screen } from '@testing-library/react'
import { PreviewModal } from './PreviewModal'
import { vi, it, expect, afterEach } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
})

it('renders video with stream url after fetch', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ stream_url: 'http://s/v' })))
  )
  render(<PreviewModal url="http://youtube/w" onClose={() => {}} />)
  const video = await screen.findByTestId('preview-video')
  expect(video).toHaveAttribute('src', 'http://s/v')
})

it('renders nothing when url is null', () => {
  const { container } = render(<PreviewModal url={null} onClose={() => {}} />)
  expect(container).toBeEmptyDOMElement()
})
