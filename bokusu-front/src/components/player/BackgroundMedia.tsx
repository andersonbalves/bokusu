import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../../lib/api'

interface BackgroundMediaProps {
  active: boolean
  disableBgMusic: boolean
  disableBgVideo: boolean
  bgMusicVolume: number
}

export function BackgroundMedia({
  active,
  disableBgMusic,
  disableBgVideo,
  bgMusicVolume,
}: BackgroundMediaProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const indexRef = useRef(0)
  const [bgVideoFailed, setBgVideoFailed] = useState(false)

  const { data: playlist = [] } = useQuery({
    queryKey: ['bgPlaylist'],
    queryFn: () => apiFetch<string[]>('/bg_playlist'),
    staleTime: Infinity,
  })

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (active && !disableBgMusic && playlist.length > 0) {
      if (!audio.getAttribute('src')) audio.src = playlist[0]
      audio.volume = bgMusicVolume
      void audio.play().catch(() => undefined)
    } else {
      audio.pause()
    }
  }, [active, disableBgMusic, bgMusicVolume, playlist])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (active) {
      void video.play().catch(() => undefined)
    } else {
      video.pause()
    }
  }, [active])

  const playNext = () => {
    const audio = audioRef.current
    if (!audio || playlist.length === 0) return
    indexRef.current = (indexRef.current + 1) % playlist.length
    audio.src = playlist[indexRef.current]
    void audio.play().catch(() => undefined)
  }

  return (
    <>
      <audio ref={audioRef} data-testid="bg-music" onEnded={playNext} />
      {!disableBgVideo && !bgVideoFailed && (
        <video
          ref={videoRef}
          data-testid="bg-video"
          className={`absolute inset-0 h-full w-full object-cover ${!active ? 'hidden' : ''}`}
          src="/stream/bg_video"
          autoPlay
          muted
          loop
          onError={() => setBgVideoFailed(true)}
        />
      )}
    </>
  )
}
