import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { launchFireworkShow } from '../../lib/fireworks'
import type { ScorePhrases } from '../../types/api'
import applauseLowUrl from '../../assets/sounds/applause-l.mp3'
import applauseMidUrl from '../../assets/sounds/applause-m.mp3'
import applauseHighUrl from '../../assets/sounds/applause-h.mp3'
import scoreDrumsUrl from '../../assets/sounds/score-drums.mp3'

const ROTATION_MS = 3000
const ROLL_INTERVAL_MS = 100
const SAFETY_TIMEOUT_MS = 15_000

/** Nota 0-99 com viés para cima (paridade com o score.js legado). */
export function computeScore(random: number = Math.random()): number {
  return Math.floor(Math.pow(random, 1 / 2) * 99)
}

function pickPhrase(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)] ?? ''
}

export function pickScoreAssets(
  score: number,
  phrases: ScorePhrases
): { applause: string; phrase: string } {
  if (score < 30) return { applause: applauseLowUrl, phrase: pickPhrase(phrases.low) }
  if (score < 60) return { applause: applauseMidUrl, phrase: pickPhrase(phrases.mid) }
  return { applause: applauseHighUrl, phrase: pickPhrase(phrases.high) }
}

interface ScoreScreenProps {
  phrases: ScorePhrases
  onFinished: () => void
}

export function ScoreScreen({ phrases, onFinished }: ScoreScreenProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onFinishedRef = useRef(onFinished)
  const phrasesRef = useRef(phrases)

  useEffect(() => {
    onFinishedRef.current = onFinished
    phrasesRef.current = phrases
  }, [onFinished, phrases])

  const [rollingNumber, setRollingNumber] = useState(0)
  const [revealed, setRevealed] = useState<{ score: number; phrase: string } | null>(null)

  useEffect(() => {
    const score = computeScore()
    const { applause, phrase } = pickScoreAssets(score, phrasesRef.current)

    const drums = new Audio(scoreDrumsUrl)
    void drums.play().catch(() => undefined)
    const roll = setInterval(() => setRollingNumber(Math.floor(Math.random() * 100)), ROLL_INTERVAL_MS)

    const applauseAudio = new Audio(applause)
    const finish = () => onFinishedRef.current()
    applauseAudio.addEventListener('ended', finish)
    const safety = setTimeout(finish, SAFETY_TIMEOUT_MS)

    let stopFireworks: () => void = () => undefined
    const reveal = setTimeout(() => {
      clearInterval(roll)
      drums.pause()
      setRevealed({ score, phrase })
      if (canvasRef.current) stopFireworks = launchFireworkShow(canvasRef.current, score)
      void applauseAudio.play().catch(() => undefined)
    }, ROTATION_MS)

    return () => {
      clearInterval(roll)
      clearTimeout(reveal)
      clearTimeout(safety)
      applauseAudio.removeEventListener('ended', finish)
      applauseAudio.pause()
      drums.pause()
      stopFireworks()
    }
  }, [])

  return (
    <div
      data-testid="score-screen"
      className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-black"
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" />
      <p className="text-outlined font-display text-4xl font-bold uppercase tracking-widest text-white">
        {t('player.yourScore')}
      </p>
      <p
        data-testid="score-number"
        className="text-outlined font-display text-[10rem] font-bold leading-none text-white"
      >
        {String(revealed?.score ?? rollingNumber).padStart(2, '0')}
      </p>
      {revealed && (
        <p data-testid="score-phrase" className="text-outlined max-w-3xl text-center text-3xl text-white/90">
          {revealed.phrase}
        </p>
      )}
    </div>
  )
}
