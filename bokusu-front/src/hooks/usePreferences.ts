import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { useSocketEvent } from './useSocketEvent'
import type { Preferences } from '../types/api'

const QUERY_KEY = ['preferences'] as const

export function usePreferences() {
  const queryClient = useQueryClient()

  useSocketEvent('preferences_update', (change: { key: string; value: unknown }) => {
    queryClient.setQueryData<Preferences>(QUERY_KEY, (old) =>
      old ? { ...old, [change.key]: change.value } : old
    )
  })
  useSocketEvent('preferences_reset', () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEY })
  })

  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      return apiFetch<Preferences>('/api/preferences')
    },
  })
}

export type SetPreferenceVariables = {
  [K in keyof Preferences]-?: { key: K; value: Preferences[K] }
}[keyof Preferences]

export function useSetPreference() {
  const queryClient = useQueryClient()

  return useMutation<
    { success: boolean; message: string },
    Error,
    SetPreferenceVariables,
    { previous: Preferences | undefined }
  >({
    mutationFn: ({ key, value }) =>
      apiFetch<{ success: boolean; message: string }>(`/api/preferences/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      }),
    onMutate: async ({ key, value }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY })
      const previous = queryClient.getQueryData<Preferences>(QUERY_KEY)
      queryClient.setQueryData<Preferences>(QUERY_KEY, (old) =>
        old ? { ...old, [key]: value } : old
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

export function useResetPreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean; message: string }>('/api/preferences', {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}
