import { render, act, screen } from '@testing-library/react'
import type { ScorePhrases } from '../../types/api'

vi.mock('../../lib/fireworks', () => ({ launchFireworkShow: vi.fn(() => vi.fn()) }))
// Vite transforma .mp3 em URL; nos testes basta uma string
vi.mock('../../assets/sounds/applause-l.mp3', () => ({ default: '/applause-l.mp3' }))
vi.mock('../../assets/sounds/applause-m.mp3', () => ({ default: '/applause-m.mp3' }))
vi.mock('../../assets/sounds/applause-h.mp3', () => ({ default: '/applause-h.mp3' }))
vi.mock('../../assets/sounds/score-drums.mp3', () => ({ default: '/score-drums.mp3' }))

import { ScoreScreen, computeScore, pickScoreAssets } from './ScoreScreen'
import { vi } from 'vitest'

class FakeAudio {
  static instances: FakeAudio[] = []
  src: string
  listeners: Record<string, () => void> = {}
  play = vi.fn().mockResolvedValue(undefined)
  pause = vi.fn()
  constructor(src: string) {
    this.src = src
    FakeAudio.instances.push(this)
  }
  addEventListener(event: string, cb: () => void) {
    this.listeners[event] = cb
  }
  removeEventListener(event: string) {
    delete this.listeners[event]
  }
}

const phrases: ScorePhrases = { low: ['fraco'], mid: ['ok'], high: ['brilhante'] }

beforeEach(() => {
  FakeAudio.instances = []
  vi.stubGlobal('Audio', FakeAudio)
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test('computeScore is 0-99 with upward bias', () => {
  expect(computeScore(0)).toBe(0)
  expect(computeScore(0.25)).toBe(49) // sqrt(0.25) * 99 = 49.5
  expect(computeScore(1)).toBe(99)
})

test('pickScoreAssets picks tier by score', () => {
  expect(pickScoreAssets(10, phrases).phrase).toBe('fraco')
  expect(pickScoreAssets(45, phrases).phrase).toBe('ok')
  expect(pickScoreAssets(90, phrases).phrase).toBe('brilhante')
})

test('reveals score and phrase after rotation, finishes when applause ends', () => {
  const onFinished = vi.fn()
  render(<ScoreScreen phrases={phrases} onFinished={onFinished} />)
  // fase de rotação: bateria tocando, nota ainda não revelada
  expect(screen.queryByTestId('score-phrase')).toBeNull()
  act(() => vi.advanceTimersByTime(3000))
  expect(screen.getByTestId('score-phrase').textContent).not.toBe('')
  expect(onFinished).not.toHaveBeenCalled()
  // aplauso termina → onFinished
  const applause = FakeAudio.instances.find((a) => a.src.includes('applause'))
  act(() => applause?.listeners['ended']?.())
  expect(onFinished).toHaveBeenCalledTimes(1)
})

test('safety timeout finishes even if applause never ends', () => {
  const onFinished = vi.fn()
  render(<ScoreScreen phrases={phrases} onFinished={onFinished} />)
  act(() => vi.advanceTimersByTime(15_000))
  expect(onFinished).toHaveBeenCalled()
})
