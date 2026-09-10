import { useEffect, useState } from 'react'
import { useSocketEvent } from '../../hooks/useSocketEvent'
import { socket } from '../../lib/socket'

const DISMISS_MS = 8000

type Severity = 'info' | 'success' | 'danger'

interface NotificationBannerProps {
  isMaster: boolean
  hideNotifications: boolean
}

export function NotificationBanner({ isMaster, hideNotifications }: NotificationBannerProps) {
  const [notification, setNotification] = useState<{ message: string; severity: Severity } | null>(
    null
  )

  useSocketEvent('notification', (payload: unknown) => {
    if (typeof payload !== 'string') return
    const [message, color] = payload.split('::is-')
    let severity: Severity = 'info'
    if (color === 'success') severity = 'success'
    else if (color === 'danger' || color === 'warning') severity = 'danger'
    setNotification({ message, severity })
    // Paridade com splash.js: o master confirma o recebimento para o servidor limpar
    if (isMaster) socket.emit('clear_notification')
  })

  useEffect(() => {
    if (!notification) return
    const timer = setTimeout(() => setNotification(null), DISMISS_MS)
    return () => clearTimeout(timer)
  }, [notification])

  if (!notification || hideNotifications) return null

  let alertClass = 'alert-info'
  if (notification.severity === 'success') alertClass = 'alert-success'
  else if (notification.severity === 'danger') alertClass = 'alert-error'

  return (
    <div
      data-testid="tv-notification"
      role="status"
      className={`alert ${alertClass} absolute top-6 right-6 z-40 max-w-md text-lg shadow-xl`}
    >
      {notification.message}
    </div>
  )
}
