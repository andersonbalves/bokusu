import { create } from 'zustand'

interface AppState {
  theme: 'aqua' | 'acid'
  isAdmin: boolean
  playerMode: 'integration' | 'cinematic'
  showAdminModal: boolean
  pendingAdminAction: (() => void) | null
  setTheme: (theme: 'aqua' | 'acid') => void
  setIsAdmin: (isAdmin: boolean) => void
  setPlayerMode: (mode: 'integration' | 'cinematic') => void
  openAdminModal: (action: () => void) => void
  closeAdminModal: () => void
}

export const useAppStore = create<AppState>((set) => ({
  theme: 'aqua',
  isAdmin: false,
  playerMode: 'integration',
  showAdminModal: false,
  pendingAdminAction: null,
  setTheme: (theme) => set({ theme }),
  setIsAdmin: (isAdmin) => set({ isAdmin }),
  setPlayerMode: (playerMode) => set({ playerMode }),
  openAdminModal: (action) => set({ showAdminModal: true, pendingAdminAction: action }),
  closeAdminModal: () => set({ showAdminModal: false, pendingAdminAction: null }),
}))
