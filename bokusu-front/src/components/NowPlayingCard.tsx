import { SkipForward, Lock } from 'lucide-react'
import type { Song } from '../types/api'

interface NowPlayingCardProps {
  song: Song
  onSkip: () => void
  canSkip: boolean
}

export function NowPlayingCard({ song, onSkip, canSkip }: NowPlayingCardProps) {
  return (
    <div className="card bg-base-200 border border-base-300 shadow-lg">
      <div className="card-body gap-3">
        <div className="badge badge-primary badge-outline text-xs uppercase tracking-wider">
          Tocando agora
        </div>
        <h2 className="font-display text-2xl leading-tight">{song.title}</h2>
        {song.singerName && (
          <p className="text-base-content/70 text-sm">{song.singerName}</p>
        )}
        <div className="card-actions justify-end pt-2">
          <button className="btn btn-sm btn-outline gap-2" onClick={onSkip} aria-label="Pular">
            {!canSkip && <Lock size={14} aria-label="admin necessário" />}
            <SkipForward size={16} />
            Pular
          </button>
        </div>
      </div>
    </div>
  )
}
