import { useCallback, useEffect, useRef, useState } from 'react'
import { socket } from '../lib/socket'

export type PlayerState = 'idle' | 'loading' | 'playing' | 'scoring'

const LOADING_TIMEOUT_MS = 10_000

export interface PlayerStateMachine {
  state: PlayerState
  mediaUrl: string | null
  handleCanPlay: () => void
  handleEnded: () => void
  handleError: () => void
  handleScoreFinished: () => void
}

interface UsePlayerStateMachineArgs {
  nowPlayingUrl: string | null
  disableScore: boolean
  isMaster: boolean
}

/**
 * Máquina de estados da TV. Dirigida por diffs de now_playing_url — não pelo
 * evento socket `play` legado, que não tem payload. Slaves são espelho passivo
 * e nunca emitem eventos de controle.
 */
export function usePlayerStateMachine({
  nowPlayingUrl,
  disableScore,
  isMaster,
}: UsePlayerStateMachineArgs): PlayerStateMachine {
  const [state, setState] = useState<PlayerState>('idle')
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state
  // Última URL já tratada. Diferente de mediaUrl: sobrevive ao fim da música,
  // para a URL antiga (que o servidor ainda não limpou) não recomeçar o playback.
  const lastUrlRef = useRef<string | null>(null)

  const emitAsMaster = useCallback(
    (event: string, ...args: unknown[]) => {
      if (isMaster) socket.emit(event, ...args)
    },
    [isMaster]
  )

  useEffect(() => {
    if (nowPlayingUrl && nowPlayingUrl !== lastUrlRef.current) {
      lastUrlRef.current = nowPlayingUrl
      setMediaUrl(nowPlayingUrl)
      setState('loading')
    } else if (!nowPlayingUrl) {
      lastUrlRef.current = null
      if (stateRef.current !== 'idle' && stateRef.current !== 'scoring') {
        // Skip/stop vindo do servidor: sem score, sem end_song (o servidor já encerrou)
        setMediaUrl(null)
        setState('idle')
      }
    }
  }, [nowPlayingUrl])

  useEffect(() => {
    if (state !== 'loading') return
    const timer = setTimeout(() => {
      emitAsMaster('end_song', 'error')
      setMediaUrl(null)
      setState('idle')
    }, LOADING_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [state, mediaUrl, emitAsMaster])

  const handleCanPlay = useCallback(() => {
    if (stateRef.current !== 'loading') return
    emitAsMaster('start_song')
    setState('playing')
  }, [emitAsMaster])

  const handleEnded = useCallback(() => {
    if (stateRef.current !== 'playing') return
    if (disableScore) {
      emitAsMaster('end_song', 'complete')
      setMediaUrl(null)
      setState('idle')
    } else {
      setState('scoring')
    }
  }, [disableScore, emitAsMaster])

  const handleError = useCallback(() => {
    if (stateRef.current !== 'loading' && stateRef.current !== 'playing') return
    emitAsMaster('end_song', 'error')
    setMediaUrl(null)
    setState('idle')
  }, [emitAsMaster])

  const handleScoreFinished = useCallback(() => {
    if (stateRef.current !== 'scoring') return
    emitAsMaster('end_song', 'complete')
    setMediaUrl(null)
    setState('idle')
  }, [emitAsMaster])

  return { state, mediaUrl, handleCanPlay, handleEnded, handleError, handleScoreFinished }
}
