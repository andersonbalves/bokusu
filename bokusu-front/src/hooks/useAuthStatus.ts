import { useEffect } from 'react'
import { apiFetch } from '../lib/api'
import { useAppStore } from '../store/useAppStore'
import type { AuthStatus } from '../types/api'

export function useAuthStatus() {
  const setIsAdmin = useAppStore((s) => s.setIsAdmin)

  useEffect(() => {
    apiFetch<AuthStatus>('/api/auth')
      .then((resp) => setIsAdmin(resp.isAdmin))
      .catch(() => setIsAdmin(false))
  }, [setIsAdmin])
}
