import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { useSocketEvent } from './useSocketEvent'
import type { NowPlaying } from '../types/api'

export function useNowPlaying() {
  const queryClient = useQueryClient()
  useSocketEvent('now_playing', (payload: NowPlaying) => {
    queryClient.setQueryData(['nowPlaying'], payload)
  })
  return useQuery({
    queryKey: ['nowPlaying'],
    queryFn: () => apiFetch<NowPlaying>('/api/player'),
  })
}
