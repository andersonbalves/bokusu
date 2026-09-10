import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'

export interface RenamerSong {
  file: string
  currentName: string
  suggestedName: string
  isEqual: boolean
}

export function useRenamerSongs(params: { page: number; onlyMismatched: boolean }) {
  return useQuery({
    queryKey: ['renamer', params],
    queryFn: () =>
      apiFetch<{ songs: RenamerSong[]; total: number; page: number }>(
        `/api/renamer/songs?page=${params.page}&only_mismatched=${params.onlyMismatched}`
      ),
  })
}

export function useApplyRename() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { oldName: string; newName: string }) =>
      apiFetch<{ success: boolean; message: string }>('/api/renamer/rename', {
        method: 'POST',
        body: JSON.stringify({ old_name: args.oldName, new_name: args.newName }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['renamer'] }),
  })
}
