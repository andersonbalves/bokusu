import { GripVertical, Trash2, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.file, disabled: !isAdmin })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-box bg-base-200 border transition-all ${
        isDragging
          ? 'shadow-lg border-primary bg-base-300 scale-[1.02] touch-none z-50'
          : 'border-base-300 hover:bg-base-300'
      }`}
    >
      {/* Grab Handle */}
      {isAdmin && (
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-base-content/40 hover:text-base-content/70 p-1"
          aria-label="Drag handle"
        >
          <GripVertical size={18} />
        </div>
      )}
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
