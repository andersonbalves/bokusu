import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import type { BrowseFilesResponse } from '../types/api'

export interface BrowseParams {
  q?: string
  letter?: string
  sort?: 'alpha' | 'date'
  page?: number
}

export function useFiles(params: BrowseParams = {}) {
  const q = params.q ?? ''
  const letter = params.letter ?? ''
  const sort = params.sort ?? 'alpha'
  const page = params.page ?? 1

  return useQuery({
    queryKey: ['files', { q, letter, sort, page }],
    queryFn: () =>
      apiFetch<BrowseFilesResponse>(
        `/api/files/browse?q=${encodeURIComponent(q)}&letter=${encodeURIComponent(
          letter
        )}&sort=${sort}&page=${page}`
      ),
  })
}

export function useDeleteFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (songPath: string) =>
      apiFetch<{ success: boolean; message: string }>(
        `/api/files?song=${encodeURIComponent(songPath)}`,
        {
          method: 'DELETE',
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] })
    },
  })
}

export interface RenameParams {
  old_file_name: string
  new_file_name: string
}

export function useRenameFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: RenameParams) =>
      apiFetch<{ success: boolean; message: string }>('/api/files', {
        method: 'PATCH',
        body: JSON.stringify(params),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] })
    },
  })
}
