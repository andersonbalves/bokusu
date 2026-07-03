import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'

export interface LibraryFile {
  path: string
  displayName: string
}

export interface LibraryPageData {
  files: LibraryFile[]
  total: number
  page: number
  perPage: number
}

export function useLibrary(params: { q: string; page: number }) {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  search.set('page', String(params.page))
  return useQuery({
    queryKey: ['library', params],
    queryFn: () => apiFetch<LibraryPageData>(`/api/files/browse?${search.toString()}`),
  })
}

export function useRenameFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { oldFileName: string; newFileName: string }) =>
      apiFetch<{ success: boolean; message: string }>('/api/files', {
        method: 'PATCH',
        body: JSON.stringify({
          old_file_name: args.oldFileName,
          new_file_name: args.newFileName,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] })
    },
  })
}

export function useDeleteFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (path: string) =>
      apiFetch<{ success: boolean; message: string }>(
        `/api/files?song=${encodeURIComponent(path)}`,
        { method: 'DELETE' }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] })
      queryClient.invalidateQueries({ queryKey: ['libraryStats'] })
    },
  })
}
