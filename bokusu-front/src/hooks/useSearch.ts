import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import type { SearchResult } from '../types/api'

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    enabled: query.length > 0,
    queryFn: () => apiFetch<SearchResult[]>(`/api/search?q=${encodeURIComponent(query)}`),
  })
}
