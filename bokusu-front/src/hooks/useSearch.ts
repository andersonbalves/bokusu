import { useQuery } from '@tanstack/react-query'
import type { SearchResult } from '../types/api'

async function fetchSearch(query: string): Promise<SearchResult[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error('Failed to search')
  return res.json()
}

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => fetchSearch(query),
    enabled: query.length > 0,
  })
}
