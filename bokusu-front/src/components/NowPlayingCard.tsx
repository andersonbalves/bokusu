import { SkipForward, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { NowPlaying } from '../types/api'

interface NowPlayingCardProps {
  nowPlaying: NowPlaying
  onSkip: () => void
  canSkip: boolean
}

export function NowPlayingCard({ nowPlaying, onSkip, canSkip }: NowPlayingCardProps) {
  const { t } = useTranslation()

  return (
    <div className="card bg-base-200 border border-base-300 shadow-lg">
      <div className="card-body gap-3">
        <div className="badge badge-primary badge-outline text-xs uppercase tracking-wider">
          {t('player.nowPlaying')}
        </div>
        <h2 className="font-display text-2xl leading-tight">{nowPlaying.now_playing}</h2>
        {nowPlaying.now_playing_user && (
          <p className="text-base-content/70 text-sm">{nowPlaying.now_playing_user}</p>
        )}
        <div className="card-actions justify-end pt-2">
          <button className="btn btn-sm btn-outline gap-2" onClick={onSkip} aria-label={t('player.skip')}>
            {!canSkip && <Lock size={14} aria-label={t('admin.required')} />}
            <SkipForward size={16} />
            {t('player.skip')}
          </button>
        </div>
      </div>
    </div>
  )
}

