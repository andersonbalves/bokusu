import { renderHook, waitFor } from '@testing-library/react'
import { useAuthStatus } from './useAuthStatus'
import { useAppStore } from '../store/useAppStore'
import { vi, it, expect, afterEach } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
})

it('hydrates isAdmin from GET /api/auth', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ isAdmin: true }), { status: 200 })
    )
  )
  useAppStore.setState({ isAdmin: false })
  renderHook(() => useAuthStatus())
  await waitFor(() => expect(useAppStore.getState().isAdmin).toBe(true))
})
