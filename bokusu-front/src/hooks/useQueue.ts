import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { useSocketEvent } from './useSocketEvent'
import type { QueueItem } from '../types/api'

export function useQueue() {
  const queryClient = useQueryClient()
  useSocketEvent('queue_update', () => {
    queryClient.invalidateQueries({ queryKey: ['queue'] })
  })
  return useQuery({
    queryKey: ['queue'],
    queryFn: () => apiFetch<QueueItem[]>('/api/queue'),
  })
}

export function useEnqueue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ song_id, user }: { song_id: string; user: string }) =>
      apiFetch<{ success: boolean }>('/api/queue', {
        method: 'POST',
        body: JSON.stringify({ song_id, user }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['queue'] }),
  })
}
