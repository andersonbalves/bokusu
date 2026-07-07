import { create } from 'zustand'

export interface Toast {
  id: number
  message: string
  severity: 'info' | 'success' | 'danger'
}

interface AppState {
  theme: 'aqua' | 'acid'
  isAdmin: boolean | null
  isConnected: boolean
  showAdminModal: boolean
  pendingAdminAction: (() => void) | null
  toasts: Toast[]
  setTheme: (theme: 'aqua' | 'acid') => void
  setIsAdmin: (isAdmin: boolean) => void
  setIsConnected: (isConnected: boolean) => void
  openAdminModal: (action: () => void) => void
  closeAdminModal: () => void
  pushToast: (message: string, severity: 'info' | 'success' | 'danger') => void
  dismissToast: (id: number) => void
}

let nextToastId = 1

export const useAppStore = create<AppState>((set) => ({
  theme: 'aqua',
  isAdmin: null,
  isConnected: true,
  showAdminModal: false,
  pendingAdminAction: null,
  toasts: [],
  setTheme: (theme) => set({ theme }),
  setIsAdmin: (isAdmin) => set({ isAdmin }),
  setIsConnected: (isConnected) => set({ isConnected }),
  openAdminModal: (action) => set({ showAdminModal: true, pendingAdminAction: action }),
  closeAdminModal: () => set({ showAdminModal: false, pendingAdminAction: null }),
  pushToast: (message, severity) => {
    const id = nextToastId++
    set((state) => ({
      toasts: [...state.toasts, { id, message, severity }],
    }))
  },
  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },
}))

