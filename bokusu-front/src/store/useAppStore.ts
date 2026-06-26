import { create } from 'zustand'

interface AppState {
  theme: 'aqua' | 'acid'
  isAdmin: boolean
  isConnected: boolean
  setTheme: (theme: 'aqua' | 'acid') => void
  setIsAdmin: (isAdmin: boolean) => void
  setIsConnected: (isConnected: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  theme: 'aqua',
  isAdmin: false,
  isConnected: true,
  setTheme: (theme) => set({ theme }),
  setIsAdmin: (isAdmin) => set({ isAdmin }),
  setIsConnected: (isConnected) => set({ isConnected }),
}))
