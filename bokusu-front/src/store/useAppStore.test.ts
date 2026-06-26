import { describe, it, expect } from 'vitest'
import { useAppStore } from './useAppStore'

describe('useAppStore', () => {
  it('should have isConnected initial state as true and allow updating', () => {
    const initialState = useAppStore.getState()
    expect(initialState.isConnected).toBe(true)

    useAppStore.getState().setIsConnected(false)
    
    expect(useAppStore.getState().isConnected).toBe(false)
  })
})
