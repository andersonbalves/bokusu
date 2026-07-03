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

export interface AutocompleteResult {
  path: string
  fileName: string
  type: 'autocomplete'
}

export function useSearchAutocomplete(query: string) {
  return useQuery({
    queryKey: ['searchAutocomplete', query],
    enabled: query.length > 0,
    queryFn: () =>
      apiFetch<AutocompleteResult[]>(`/api/search/autocomplete?q=${encodeURIComponent(query)}`),
  })
}

export interface PreviewResult {
  stream_url: string
}

export function useSearchPreview(url: string) {
  return useQuery({
    queryKey: ['searchPreview', url],
    enabled: url.length > 0,
    queryFn: () => apiFetch<PreviewResult>(`/api/search/preview?url=${encodeURIComponent(url)}`),
  })
}
