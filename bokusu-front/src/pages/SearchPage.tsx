import { useState, useCallback, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { useSearch } from '../hooks/useSearch'
import { useAddToQueue } from '../hooks/useQueue'
import { SearchResultItem } from '../components/SearchResultItem'

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [addingId, setAddingId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  const { data: results = [], isFetching } = useSearch(debouncedQuery)
  const addMutation = useAddToQueue()

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToastMessage(msg)
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 2500)
  }, [])

  const handleAdd = (id: string, title: string) => {
    setAddingId(id)
    addMutation.mutate(id, {
      onSuccess: () => {
        showToast(`"${title}" adicionada à fila!`)
        setAddingId(null)
      },
      onError: () => {
        showToast('Erro ao adicionar. Tente novamente.')
        setAddingId(null)
      },
    })
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Sticky search bar */}
      <div className="p-4 pb-2 sticky top-0 bg-base-100 z-10 border-b border-base-200">
        <label className="input flex items-center gap-2 w-full">
          <Search size={18} className="text-base-content/40" />
          <input
            type="search"
            className="grow"
            placeholder="Buscar músicas..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {isFetching && <span className="loading loading-spinner loading-xs" />}
        </label>
      </div>

      {/* Results */}
      <div className="flex-1 px-4 py-2">
        {results.length === 0 && debouncedQuery.length > 0 && !isFetching && (
          <p className="text-center text-base-content/40 py-12">
            Nenhum resultado para &quot;{debouncedQuery}&quot;
          </p>
        )}
        {results.map((result) => (
          <SearchResultItem
            key={result.id}
            result={result}
            onAdd={() => handleAdd(result.id, result.title)}
            isAdding={addingId === result.id}
          />
        ))}
      </div>

      {/* Toast — above bottom nav on mobile */}
      {toastMessage && (
        <div className="toast toast-center toast-bottom z-50 pb-20 lg:pb-4">
          <div className="alert alert-success shadow-lg">
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  )
}
