import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { useSocketEvent } from './useSocketEvent'

export interface DownloadItem {
  id: string
  title: string
  url: string
  progress: number
  status: 'active' | 'pending' | 'completed' | 'failed'
  error?: string
}

export interface DownloadsStatus {
  active: DownloadItem | null
  pending: DownloadItem[]
  errors: DownloadItem[]
}

export function useDownloads() {
  const queryClient = useQueryClient()

  // Invalidate queries on socket download updates
  useSocketEvent('download_started', () => {
    queryClient.invalidateQueries({ queryKey: ['downloads'] })
  })
  useSocketEvent('download_stopped', () => {
    queryClient.invalidateQueries({ queryKey: ['downloads'] })
  })

  return useQuery({
    queryKey: ['downloads'],
    queryFn: () => apiFetch<DownloadsStatus>('/api/downloads'),
  })
}

export interface StartDownloadParams {
  song_url: string
  song_added_by: string
  song_title: string
  queue: boolean
}

export function useStartDownload() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: StartDownloadParams) =>
      apiFetch<{ status: string }>('/api/downloads', {
        method: 'POST',
        body: JSON.stringify(params),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downloads'] })
    },
  })
}

export function useDismissDownloadError() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (errorId: string) =>
      apiFetch<{ success: boolean }>(`/api/downloads/errors/${errorId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downloads'] })
    },
  })
}
