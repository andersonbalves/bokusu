import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { useSocketEvent } from './useSocketEvent'
import type { ScorePhrases } from '../types/api'

export function useScorePhrases() {
  const queryClient = useQueryClient()
  useSocketEvent('score_phrases_update', (phrases: ScorePhrases) => {
    queryClient.setQueryData(['scorePhrases'], phrases)
  })
  return useQuery({
    queryKey: ['scorePhrases'],
    queryFn: () => apiFetch<ScorePhrases>('/api/player/score-phrases'),
  })
}
