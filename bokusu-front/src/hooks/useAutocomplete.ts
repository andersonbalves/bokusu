import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import type { AutocompleteResult } from './useSearch'

export function useAutocomplete(query: string) {
  return useQuery({
    queryKey: ['searchAutocomplete', query],
    enabled: query.length > 0,
    queryFn: () =>
      apiFetch<AutocompleteResult[]>(`/api/search/autocomplete?q=${encodeURIComponent(query)}`),
  })
}
