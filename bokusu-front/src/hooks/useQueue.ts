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

export function useReorderQueue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ oldIndex, newIndex }: { oldIndex: number; newIndex: number }) =>
      apiFetch<{ success: boolean }>('/api/queue/reorder', {
        method: 'PUT',
        body: JSON.stringify({ old_index: oldIndex, new_index: newIndex }),
      }),
    onMutate: async ({ oldIndex, newIndex }) => {
      await queryClient.cancelQueries({ queryKey: ['queue'] })
      const previous = queryClient.getQueryData<QueueItem[]>(['queue'])

      if (previous) {
        const next = [...previous]
        const [moved] = next.splice(oldIndex, 1)
        next.splice(newIndex, 0, moved)
        queryClient.setQueryData(['queue'], next)
      }

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['queue'], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] })
    },
  })
}

export function useQueueItemAction() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['queue'] })

  const move = useMutation({
    mutationFn: ({ song, action }: { song: string; action: 'top' | 'bottom' | 'up' | 'down' }) =>
      apiFetch<{ success: boolean }>('/api/queue/item', {
        method: 'PATCH',
        body: JSON.stringify({ song, action }),
      }),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (song: string) =>
      apiFetch<{ success: boolean }>(`/api/queue/item?song=${encodeURIComponent(song)}`, {
        method: 'DELETE',
      }),
    onSuccess: invalidate,
  })

  return { move, remove }
}

export function useClearQueue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<{ success: boolean }>('/api/queue', { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['queue'] }),
  })
}

export function useAddRandom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (amount: number) =>
      apiFetch<{ success: boolean }>('/api/queue/random', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['queue'] }),
  })
}
