import { Trash2, Lock } from 'lucide-react'
import type { Song } from '../types/api'

interface QueueItemProps {
  song: Song
  isAdmin: boolean
  onRemove: () => void
  removeDisabled?: boolean
}

export function QueueItem({ song, isAdmin, onRemove, removeDisabled }: QueueItemProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-box bg-base-200 hover:bg-base-300 transition-colors">
      <span className="text-base-content/40 w-6 text-center tabular-nums text-sm">
        {song.position + 1}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{song.title}</p>
        {song.singerName && (
          <p className="text-base-content/60 text-sm truncate">{song.singerName}</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        {!isAdmin && (
          <Lock size={12} className="text-warning" aria-label="admin necessário" />
        )}
        <button
          className="btn btn-ghost btn-xs text-error"
          onClick={onRemove}
          disabled={removeDisabled}
          aria-label="Remover"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}
