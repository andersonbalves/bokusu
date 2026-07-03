import { Play, Pause, SkipForward, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNowPlaying } from '../hooks/useNowPlaying'
import { usePlayerControls } from '../hooks/usePlayerControls'
import { useAppStore } from '../store/useAppStore'

interface MiniPlayerProps {
  onExpand: () => void
}

export function MiniPlayer({ onExpand }: MiniPlayerProps) {
  const { t } = useTranslation()
  const { data } = useNowPlaying()
  const { skip, play, pause } = usePlayerControls()
  const { isAdmin, openAdminModal } = useAppStore()

  if (!data?.now_playing) {
    return null
  }

  const guarded = (action: () => void) => {
    if (!isAdmin) {
      openAdminModal(action)
    } else {
      action()
    }
  }

  const handlePlayPause = () => {
    guarded(() => {
      if (data.is_paused) {
        play.mutate()
      } else {
        pause.mutate()
      }
    })
  }

  const handleSkip = () => {
    guarded(() => {
      skip.mutate()
    })
  }

  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-base-300/50 border border-base-300 rounded-xl shadow-md backdrop-blur-md">
      <button
        onClick={onExpand}
        className="flex flex-col flex-1 min-w-0 text-left items-start hover:opacity-85 active:scale-[0.98] transition-all"
      >
        <span className="font-display font-bold text-sm truncate w-full text-base-content leading-tight">
          {data.now_playing}
        </span>
        {data.now_playing_user && (
          <span className="text-xs text-base-content/60 truncate w-full">
            {data.now_playing_user}
          </span>
        )}
      </button>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={handlePlayPause}
          className="btn btn-sm btn-circle btn-ghost relative hover:bg-base-content/10 transition-colors"
          aria-label={data.is_paused ? t('player.play') : t('player.pause')}
        >
          {data.is_paused ? <Play size={18} className="text-primary fill-primary/20" /> : <Pause size={18} className="text-primary fill-primary/20" />}
          {!isAdmin && (
            <div className="absolute -bottom-1 -right-1 bg-base-300 p-0.5 rounded-full border border-base-100/20 shadow-sm text-base-content/70">
              <Lock size={8} />
            </div>
          )}
        </button>
        <button
          onClick={handleSkip}
          className="btn btn-sm btn-circle btn-ghost relative hover:bg-base-content/10 transition-colors"
          aria-label={t('player.skip')}
        >
          <SkipForward size={18} className="text-base-content/70" />
          {!isAdmin && (
            <div className="absolute -bottom-1 -right-1 bg-base-300 p-0.5 rounded-full border border-base-100/20 shadow-sm text-base-content/70">
              <Lock size={8} />
            </div>
          )}
        </button>
      </div>
    </div>
  )
}
