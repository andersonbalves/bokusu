import { useEffect } from 'react'
import { useAppStore, Toast } from '../store/useAppStore'
import { useSocketEvent } from '../hooks/useSocketEvent'

interface ToastItemProps {
  toast: Toast
  onDismiss: (id: number) => void
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id)
    }, 4000)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  let alertClass = 'alert-info'
  if (toast.severity === 'success') {
    alertClass = 'alert-success'
  } else if (toast.severity === 'danger') {
    alertClass = 'alert-error'
  }

  const role = toast.severity === 'danger' ? 'alert' : 'status'

  return (
    <div
      role={role}
      aria-live="polite"
      className={`alert ${alertClass} shadow-lg flex justify-between items-center gap-4`}
    >
      <span>{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="btn btn-ghost btn-circle btn-xs text-current"
        aria-label="Fechar"
      >
        ✕
      </button>
    </div>
  )
}

export function ToastHost() {
  const toasts = useAppStore((state) => state.toasts)
  const pushToast = useAppStore((state) => state.pushToast)
  const dismissToast = useAppStore((state) => state.dismissToast)

  useSocketEvent('notification', (payload: unknown) => {
    if (typeof payload !== 'string') return
    const parts = payload.split('::is-')
    const message = parts[0]
    const color = parts[1]

    let severity: 'info' | 'success' | 'danger' = 'info'
    if (color === 'success') {
      severity = 'success'
    } else if (color === 'danger' || color === 'warning') {
      severity = 'danger'
    }

    pushToast(message, severity)
  })

  useSocketEvent('sync_started', () => {
    pushToast('Sincronizando biblioteca...', 'info')
  })

  useSocketEvent('sync_finished', () => {
    pushToast('Biblioteca sincronizada', 'success')
  })

  if (toasts.length === 0) return null

  return (
    <div className="toast toast-top toast-end z-[9999] flex flex-col gap-2 p-4">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  )
}
