import { Plus } from 'lucide-react'
import type { SearchResult } from '../types/api'

interface SearchResultItemProps {
  result: SearchResult
  onAdd: () => void
  isAdding: boolean
}

export function SearchResultItem({ result, onAdd, isAdding }: SearchResultItemProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-box hover:bg-base-200 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{result.title}</p>
        <p className="text-base-content/60 text-sm truncate font-mono">{result.id}</p>
      </div>
      <button
        className="btn btn-circle btn-sm btn-primary flex-shrink-0"
        onClick={onAdd}
        disabled={isAdding}
        aria-label="Adicionar"
      >
        {isAdding ? (
          <span className="loading loading-spinner loading-xs" />
        ) : (
          <Plus size={18} />
        )}
      </button>
    </div>
  )
}
