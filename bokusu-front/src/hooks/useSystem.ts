import { useMutation, useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { useAppStore } from '../store/useAppStore'

export interface SystemInfo {
  cpu: string
  memory: string
  disk: string
  youtubedlVersion: string
  pikaraokeVersion: string
}

export type SystemAction =
  | 'update-ytdl'
  | 'sync-library'
  | 'quit'
  | 'shutdown'
  | 'reboot'
  | 'expand-fs'

export function useSystemInfo() {
  const isAdmin = useAppStore((s) => s.isAdmin)
  return useQuery({
    queryKey: ['systemInfo'],
    enabled: isAdmin,
    refetchInterval: 10000,
    queryFn: () => apiFetch<SystemInfo>('/api/system/info'),
  })
}

export function useLibraryStats() {
  const isAdmin = useAppStore((s) => s.isAdmin)
  return useQuery({
    queryKey: ['libraryStats'],
    enabled: isAdmin,
    queryFn: () => apiFetch<{ song_count: number }>('/api/system/library-stats'),
  })
}

export function useSystemAction() {
  return useMutation({
    mutationFn: (action: SystemAction) =>
      apiFetch<{ status: string }>(`/api/system/${action}`, { method: 'POST' }),
  })
}
