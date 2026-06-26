import { io, Socket } from 'socket.io-client'
import { useAppStore } from '../store/useAppStore'

export const socket: Socket = io()

socket.on('connect', () => {
  useAppStore.getState().setIsConnected(true)
})

socket.on('disconnect', () => {
  useAppStore.getState().setIsConnected(false)
})
