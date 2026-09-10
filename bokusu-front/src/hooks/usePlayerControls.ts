import { useMutation } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'

export function usePlayerControls() {
  const skip = useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean }>('/api/player/action', {
        method: 'POST',
        body: JSON.stringify({ action: 'skip' }),
      }),
  })
  const play = useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean }>('/api/player/action', {
        method: 'POST',
        body: JSON.stringify({ action: 'play' }),
      }),
  })
  const pause = useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean }>('/api/player/action', {
        method: 'POST',
        body: JSON.stringify({ action: 'pause' }),
      }),
  })
  const restart = useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean }>('/api/player/action', {
        method: 'POST',
        body: JSON.stringify({ action: 'restart' }),
      }),
  })
  const setVolume = useMutation({
    mutationFn: (level: number) =>
      apiFetch<{ success: boolean }>('/api/player/volume', {
        method: 'POST',
        body: JSON.stringify({ level }),
      }),
  })
  const setTranspose = useMutation({
    mutationFn: (level: number) =>
      apiFetch<{ success: boolean }>('/api/player/pitch', {
        method: 'POST',
        body: JSON.stringify({ level }),
      }),
  })
  return { skip, play, pause, restart, setVolume, setTranspose }
}
