import { useState, useCallback, useEffect, useRef } from 'react'
import { Search, FolderOpen, ListPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSearch, useSearchAutocomplete } from '../hooks/useSearch'
import { useStartDownload } from '../hooks/useDownloads'
import { useEnqueue } from '../hooks/useQueue'
import { SearchResultItem } from '../components/SearchResultItem'
import { PreviewModal } from '../components/PreviewModal'
import type { SearchResult } from '../types/api'

export function SearchPage() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [addingId, setAddingId] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  // Click outside to close autocomplete suggestions
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const { data: results = [], isFetching } = useSearch(debouncedQuery)
  const { data: suggestions = [] } = useSearchAutocomplete(debouncedQuery)
  const startDownload = useStartDownload()
  const enqueue = useEnqueue()

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToastMessage(msg)
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 2500)
  }, [])

  const handleAdd = (result: SearchResult, queue: boolean) => {
    setAddingId(result.id)
    startDownload.mutate(
      {
        song_url: result.url,
        song_added_by: 'Guest',
        song_title: result.title,
        queue: queue,
      },
      {
        onSuccess: () => {
          showToast(
            queue
              ? t('search.added', { title: result.title })
              : t('search.downloadStarted', { title: result.title })
          )
          setAddingId(null)
        },
        onError: () => {
          showToast(t('search.error'))
          setAddingId(null)
        },
      }
    )
  }

  return (
    <div className="flex flex-col min-h-full" ref={containerRef}>
      {/* Sticky search bar */}
      <div className="p-4 pb-2 sticky top-0 bg-base-100 z-10 border-b border-base-200">
        <label className="input flex items-center gap-2 w-full relative">
          <Search size={18} className="text-base-content/40" />
          <input
            type="search"
            className="grow"
            placeholder={t('search.placeholder')}
            value={query}
            onFocus={() => setShowSuggestions(true)}
            onChange={(e) => {
              setQuery(e.target.value)
              setShowSuggestions(true)
            }}
          />
          {isFetching && <span className="loading loading-spinner loading-xs" />}
        </label>

        {/* Autocomplete suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute left-4 right-4 menu bg-base-200 rounded-box border border-base-300 shadow-lg mt-1 z-30 max-h-60 overflow-y-auto">
            <li className="menu-title text-xs text-base-content/40 flex items-center gap-1 p-2">
              <FolderOpen size={12} /> {t('search.localSuggestions')}
            </li>
            {suggestions.map((s) => (
              <li key={s.path} className="flex flex-row items-center">
                <button
                  type="button"
                  onClick={() => {
                    setQuery(s.fileName)
                    setShowSuggestions(false)
                  }}
                  className="flex-1 truncate text-sm py-2 px-3 hover:bg-base-300"
                >
                  {s.fileName}
                </button>
                <button
                  type="button"
                  aria-label={t('search.addLocalToQueue')}
                  className="btn btn-ghost btn-sm btn-circle text-primary"
                  onClick={() => {
                    setShowSuggestions(false)
                    enqueue.mutate(
                      { song_id: s.path, user: 'Guest' },
                      {
                        onSuccess: () => showToast(t('search.added', { title: s.fileName })),
                        onError: () => showToast(t('search.error')),
                      }
                    )
                  }}
                >
                  <ListPlus size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 px-4 py-2 flex flex-col gap-2">
        {results.length === 0 && debouncedQuery.length >= 3 && !isFetching && (
          <p className="text-center text-base-content/40 py-12">
            {t('search.noResults')} &quot;{debouncedQuery}&quot;
          </p>
        )}

        {results.map((result) => (
          <SearchResultItem
            key={result.id}
            result={result}
            onAdd={(queue) => handleAdd(result, queue)}
            onPreview={() => setPreviewUrl(result.url)}
            isAdding={addingId === result.id}
          />
        ))}
      </div>

      {/* Preview Modal */}
      <PreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />

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
