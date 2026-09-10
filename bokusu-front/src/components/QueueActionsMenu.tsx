import { MoreVertical, ArrowUpToLine, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQueueItemAction } from '../hooks/useQueue'
import { useAppStore } from '../store/useAppStore'

interface QueueActionsMenuProps {
  song: string
}

export function QueueActionsMenu({ song }: QueueActionsMenuProps) {
  const { t } = useTranslation()
  const { move, remove } = useQueueItemAction()
  const { isAdmin, openAdminModal } = useAppStore()

  const guarded = (action: () => void) => () => {
    if (isAdmin) action()
    else openAdminModal(action)
  }

  return (
    <div className="dropdown dropdown-end">
      <button
        type="button"
        className="btn btn-ghost btn-circle btn-sm"
        aria-label={t('queue.options')}
      >
        <MoreVertical size={18} />
      </button>
      <ul
        className="dropdown-content menu bg-base-200 rounded-box z-50 w-48 shadow p-2"
        style={{ position: 'absolute', right: 0 }}
      >
        <li>
          <button
            type="button"
            onClick={guarded(() => move.mutate({ song, action: 'top' }))}
          >
            <ArrowUpToLine size={16} />
            {t('queue.playNext')}
          </button>
        </li>
        <li>
          <button
            type="button"
            className="text-error"
            onClick={guarded(() => remove.mutate(song))}
          >
            <Trash2 size={16} />
            {t('queue.delete')}
          </button>
        </li>
      </ul>
    </div>
  )
}
