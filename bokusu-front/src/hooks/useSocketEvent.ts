import { useEffect, useRef } from 'react'
import { socket } from '../lib/socket'

export function useSocketEvent<T = unknown>(eventName: string, callback: (data: T) => void) {
  const cbRef = useRef(callback)
  cbRef.current = callback

  useEffect(() => {
    const handler = (data: T) => cbRef.current(data)
    socket.on(eventName, handler)
    return () => {
      socket.off(eventName, handler)
    }
  }, [eventName])
}
