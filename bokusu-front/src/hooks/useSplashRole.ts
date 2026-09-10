import { useEffect, useState } from 'react'
import { socket } from '../lib/socket'

export type SplashRole = 'master' | 'slave'

/** Registra a tela como splash no servidor e devolve o papel atribuído (master controla o playback). */
export function useSplashRole(): SplashRole | null {
  const [role, setRole] = useState<SplashRole | null>(null)

  useEffect(() => {
    const register = () => socket.emit('register_splash')
    const onRole = (assigned: SplashRole) => setRole(assigned)

    socket.on('connect', register)
    socket.on('splash_role', onRole)
    if (socket.connected) register()

    return () => {
      socket.off('connect', register)
      socket.off('splash_role', onRole)
      if (socket.connected) socket.emit('unregister_splash')
    }
  }, [])

  return role
}
