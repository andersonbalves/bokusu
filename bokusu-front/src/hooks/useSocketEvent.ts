import { useEffect, useRef } from 'react'
import { socket } from '../lib/socket'

export function useSocketEvent(eventName: string, callback: (...args: any[]) => void) {
  const cbRef = useRef(callback)
  cbRef.current = callback

  useEffect(() => {
    const handler = (...args: any[]) => cbRef.current(...args)
    socket.on(eventName, handler)
    return () => {
      socket.off(eventName, handler)
    }
  }, [eventName])
}
