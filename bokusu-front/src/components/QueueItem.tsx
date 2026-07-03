import { Trash2, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { QueueItem as QueueItemType } from '../types/api'

interface QueueItemProps {
  item: QueueItemType
  position: number
  isAdmin: boolean
  onRemove: () => void
  removeDisabled?: boolean
}

export function QueueItem({ item, position, isAdmin, onRemove, removeDisabled }: QueueItemProps) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-3 p-3 rounded-box bg-base-200 hover:bg-base-300 transition-colors">
      <span className="text-base-content/40 w-6 text-center tabular-nums text-sm">
        {position}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{item.title}</p>
        {item.user && (
          <p className="text-base-content/60 text-sm truncate">{item.user}</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        {!isAdmin && (
          <Lock size={12} className="text-warning" aria-label={t('admin.required')} />
        )}
        <button
          className="btn btn-ghost btn-xs text-error"
          onClick={onRemove}
          disabled={removeDisabled}
          aria-label={t('common.remove')}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}

