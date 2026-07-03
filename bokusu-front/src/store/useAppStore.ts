import { create } from 'zustand'

interface AppState {
  theme: 'aqua' | 'acid'
  isAdmin: boolean
  isConnected: boolean
  showAdminModal: boolean
  pendingAdminAction: (() => void) | null
  setTheme: (theme: 'aqua' | 'acid') => void
  setIsAdmin: (isAdmin: boolean) => void
  setIsConnected: (isConnected: boolean) => void
  openAdminModal: (action: () => void) => void
  closeAdminModal: () => void
}

export const useAppStore = create<AppState>((set) => ({
  theme: 'aqua',
  isAdmin: false,
  isConnected: true,
  showAdminModal: false,
  pendingAdminAction: null,
  setTheme: (theme) => set({ theme }),
  setIsAdmin: (isAdmin) => set({ isAdmin }),
  setIsConnected: (isConnected) => set({ isConnected }),
  openAdminModal: (action) => set({ showAdminModal: true, pendingAdminAction: action }),
  closeAdminModal: () => set({ showAdminModal: false, pendingAdminAction: null }),
}))
