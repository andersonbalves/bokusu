import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Song } from '../types/api'

async function fetchQueue(): Promise<Song[]> {
  const res = await fetch('/api/queue')
  if (!res.ok) throw new Error('Failed to fetch queue')
  return res.json()
}

async function skipSong(): Promise<void> {
  const res = await fetch('/api/skip', { method: 'POST' })
  if (!res.ok) throw new Error('Failed to skip song')
}

async function addToQueue(videoId: string): Promise<void> {
  const res = await fetch('/api/queue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_id: videoId }),
  })
  if (!res.ok) throw new Error('Failed to add to queue')
}

export function useQueue() {
  return useQuery({ queryKey: ['queue'], queryFn: fetchQueue, refetchInterval: 3000 })
}

export function useSkipSong() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: skipSong,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['queue'] }),
  })
}

export function useAddToQueue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: addToQueue,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['queue'] }),
  })
}
