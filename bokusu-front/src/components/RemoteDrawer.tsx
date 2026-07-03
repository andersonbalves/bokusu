import { useEffect, useRef, useState } from 'react'
import { X, RotateCcw, Play, Pause, SkipForward } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNowPlaying } from '../hooks/useNowPlaying'
import { usePlayerControls } from '../hooks/usePlayerControls'
import { useAppStore } from '../store/useAppStore'

interface RemoteDrawerProps {
  open: boolean
  onClose: () => void
}

export function RemoteDrawer({ open, onClose }: RemoteDrawerProps) {
  const { t } = useTranslation()
  const { data } = useNowPlaying()
  const { skip, play, pause, restart, setVolume, setTranspose } = usePlayerControls()
  const { isAdmin, openAdminModal } = useAppStore()

  const [volume, setVolumeState] = useState(data?.volume ?? 0.85)
  const volumeTimer = useRef<any>(null)

  useEffect(() => {
    if (data?.volume !== undefined) {
      setVolumeState(data.volume)
    }
  }, [data?.volume])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  useEffect(() => {
    return () => {
      if (volumeTimer.current) {
        clearTimeout(volumeTimer.current)
      }
    }
  }, [])

  if (!open || !data?.now_playing) {
    return null
  }

  const guarded = (action: () => void) => {
    if (!isAdmin) {
      openAdminModal(action)
    } else {
      action()
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value)
    setVolumeState(value)
    if (volumeTimer.current) {
      clearTimeout(volumeTimer.current)
    }
    volumeTimer.current = setTimeout(() => {
      guarded(() => {
        setVolume.mutate(value)
      })
    }, 300)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="modal modal-open modal-bottom sm:modal-middle z-50"
    >
      <div className="modal-box max-w-md w-full relative p-6 bg-base-200 border border-base-300 rounded-2xl shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-base-content/50">
              {t('player.nowPlaying')}
            </span>
            <h3 className="font-display font-bold text-lg text-base-content leading-tight truncate mt-1">
              {data.now_playing}
            </h3>
            {data.now_playing_user && (
              <p className="text-sm text-base-content/60 truncate mt-0.5">
                {t('player.singer')}: {data.now_playing_user}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="btn btn-sm btn-circle btn-ghost text-base-content/70 hover:bg-base-content/10"
            aria-label={t('common.close')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-6">
          {/* Buttons: Restart, Play/Pause, Skip */}
          <div className="flex items-center justify-center gap-6">
            {/* Restart */}
            <button
              onClick={() => guarded(() => restart.mutate())}
              className="btn btn-circle btn-ghost text-base-content/70 hover:bg-base-content/10"
              aria-label={t('player.restart')}
            >
              <RotateCcw size={22} />
            </button>

            {/* Play/Pause */}
            <button
              onClick={() =>
                guarded(() => {
                  if (data.is_paused) {
                    play.mutate()
                  } else {
                    pause.mutate()
                  }
                })
              }
              className="btn btn-circle btn-primary btn-lg shadow-lg hover:scale-105 active:scale-95 transition-all"
              aria-label={data.is_paused ? t('player.play') : t('player.pause')}
            >
              {data.is_paused ? (
                <Play size={28} className="fill-primary-content" />
              ) : (
                <Pause size={28} className="fill-primary-content" />
              )}
            </button>

            {/* Skip */}
            <button
              onClick={() => guarded(() => skip.mutate())}
              className="btn btn-circle btn-ghost text-base-content/70 hover:bg-base-content/10"
              aria-label={t('player.skip')}
            >
              <SkipForward size={22} />
            </button>
          </div>

          {/* Volume */}
          <div className="form-control w-full">
            <div className="flex justify-between items-center mb-1 text-sm font-semibold text-base-content/70">
              <span>{t('player.volume')}</span>
              <span>{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={handleVolumeChange}
              className="range range-primary range-sm"
              aria-label={t('player.volume')}
              aria-valuetext={`${Math.round(volume * 100)}%`}
            />
          </div>

          {/* Transpose */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-base-content/70">
              {t('player.transpose')}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  guarded(() =>
                    setTranspose.mutate(data.now_playing_transpose - 1)
                  )
                }
                className="btn btn-sm btn-outline flex-1"
                aria-label="Decrease transpose by 1"
              >
                -1
              </button>
              <div className="badge badge-primary badge-lg font-bold px-4 py-3">
                {data.now_playing_transpose > 0 ? `+${data.now_playing_transpose}` : data.now_playing_transpose}
              </div>
              <button
                onClick={() =>
                  guarded(() =>
                    setTranspose.mutate(data.now_playing_transpose + 1)
                  )
                }
                className="btn btn-sm btn-outline flex-1"
                aria-label="Increase transpose by 1"
              >
                +1
              </button>
            </div>
          </div>
        </div>
      </div>
      <button
        type="button"
        className="modal-backdrop backdrop-blur-xs"
        aria-label={t('common.close')}
        onClick={onClose}
      />
    </div>
  )
}
