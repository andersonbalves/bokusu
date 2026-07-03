import { Play, Plus, Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SearchResult } from '../types/api'

interface SearchResultItemProps {
  result: SearchResult
  onAdd: (queue: boolean) => void
  onPreview: () => void
  isAdding: boolean
}

export function SearchResultItem({ result, onAdd, onPreview, isAdding }: SearchResultItemProps) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-3 p-3 rounded-box hover:bg-base-200 border border-base-300 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{result.title}</p>
        <p className="text-xs text-base-content/40 truncate">{result.id}</p>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="btn btn-ghost btn-circle btn-sm"
          onClick={onPreview}
          aria-label={t('search.preview')}
          title={t('search.preview')}
        >
          <Play size={16} />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-circle btn-sm text-base-content/75"
          onClick={() => onAdd(false)}
          disabled={isAdding}
          aria-label={t('search.downloadOnly')}
          title={t('search.downloadOnly')}
        >
          <Download size={16} />
        </button>
        <button
          type="button"
          className="btn btn-primary btn-circle btn-sm"
          onClick={() => onAdd(true)}
          disabled={isAdding}
          aria-label={t('search.addToQueue')}
          title={t('search.addToQueue')}
        >
          {isAdding ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <Plus size={16} />
          )}
        </button>
      </div>
    </div>
  )
}
