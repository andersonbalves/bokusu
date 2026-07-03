import Hls from 'hls.js'
import SubtitlesOctopus from 'libass-wasm'
import { useEffect, useRef } from 'react'
import workerUrl from 'libass-wasm/dist/js/subtitles-octopus-worker.js?url'
import arialFontUrl from '../../assets/fonts/Arial.ttf?url'
import fallbackFontUrl from '../../assets/fonts/DroidSansFallback.ttf?url'
import { useSocketEvent } from '../../hooks/useSocketEvent'
import { socket } from '../../lib/socket'

const POSITION_HEARTBEAT_MS = 1000
const SLAVE_DRIFT_TOLERANCE_S = 2

export interface KaraokePlayerProps {
  url: string
  subtitleUrl: string | null
  isPaused: boolean
  volume: number
  isMaster: boolean
  onCanPlay: () => void
  onEnded: () => void
  onError: () => void
}

export function KaraokePlayer({
  url,
  subtitleUrl,
  isPaused,
  volume,
  isMaster,
  onCanPlay,
  onEnded,
  onError,
}: KaraokePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Carrega a mídia: hls.js para .m3u8 sem suporte nativo; src direto nos demais casos
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let hls: Hls | null = null
    if (url.endsWith('.m3u8') && !video.canPlayType('application/vnd.apple.mpegurl')) {
      hls = new Hls({ startPosition: 0 })
      hls.loadSource(url)
      hls.attachMedia(video)
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          onError()
        }
      })
    } else {
      video.src = url
    }
    void video.play().catch(() => {
      // Autoplay bloqueado: uma única nova tentativa (paridade com splash.js)
      setTimeout(() => void videoRef.current?.play().catch(() => undefined), 1000)
    })
    return () => {
      hls?.destroy()
      video.removeAttribute('src')
      video.load()
    }
  }, [url, onError])

  // Legendas ASS (CDG e afins chegam como vídeo; ASS chega por now_playing_subtitle_url)
  useEffect(() => {
    const video = videoRef.current
    if (!video || !subtitleUrl) return
    const octopus = new SubtitlesOctopus({
      video,
      subUrl: subtitleUrl,
      fonts: [arialFontUrl, fallbackFontUrl],
      workerUrl,
    })
    return () => octopus.dispose()
  }, [subtitleUrl])

  // Pause/resume dirigido pelo is_paused do now_playing
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (isPaused) video.pause()
    else void video.play().catch(() => undefined)
  }, [isPaused])

  useEffect(() => {
    const video = videoRef.current
    if (video) video.volume = volume
  }, [volume])

  useSocketEvent('restart', () => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = 0
    if (video.paused) void video.play().catch(() => undefined)
  })

  // Master: heartbeat de posição para sync de slaves e do transcode
  useEffect(() => {
    if (!isMaster) return
    const interval = setInterval(() => {
      const video = videoRef.current
      if (video && !video.paused && !video.ended) {
        socket.emit('playback_position', video.currentTime)
      }
    }, POSITION_HEARTBEAT_MS)
    return () => clearInterval(interval)
  }, [isMaster])

  // Slave: sincroniza com a posição reportada pelo master
  useSocketEvent('playback_position', (position: number) => {
    if (isMaster) return
    const video = videoRef.current
    if (video && Math.abs(video.currentTime - position) > SLAVE_DRIFT_TOLERANCE_S) {
      video.currentTime = position
    }
  })

  return (
    <video
      ref={videoRef}
      data-testid="karaoke-video"
      className="h-full w-full bg-black object-contain"
      onCanPlay={onCanPlay}
      onEnded={onEnded}
      onError={onError}
    />
  )
}
