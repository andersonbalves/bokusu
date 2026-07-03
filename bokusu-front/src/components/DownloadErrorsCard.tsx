import { AlertTriangle, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDownloads, useDismissDownloadError } from '../hooks/useDownloads'

export function DownloadErrorsCard() {
  const { t } = useTranslation()
  const { data } = useDownloads()
  const dismiss = useDismissDownloadError()

  if (!data || data.errors.length === 0) return null
  return (
    <div className="collapse collapse-arrow bg-error/10 border border-error/30 w-full rounded-box">
      <input type="checkbox" aria-label={t('queue.downloadErrors')} />
      <div className="collapse-title flex items-center gap-2 text-error font-medium">
        <AlertTriangle size={16} />
        {t('queue.downloadErrors')} ({data.errors.length})
      </div>
      <div className="collapse-content flex flex-col gap-2">
        {data.errors.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-2 text-sm py-1 border-b border-error/10 last:border-b-0">
            <span className="truncate font-medium">{String(e.title ?? e.id)}</span>
            <button
              type="button"
              className="btn btn-ghost btn-xs hover:bg-error/20"
              aria-label={t('common.dismiss')}
              onClick={() => dismiss.mutate(e.id)}
            >
              <X size={14} className="text-error" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
