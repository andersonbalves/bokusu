import { renderHook, act } from '@testing-library/react'
import { useAppStore } from './useAppStore'

beforeEach(() => {
  useAppStore.setState({
    theme: 'aqua',
    isAdmin: false,
    isConnected: true,
    showAdminModal: false,
    pendingAdminAction: null,
  })
})

test('isConnected defaults to true and is settable', () => {
  expect(useAppStore.getState().isConnected).toBe(true)
  act(() => useAppStore.getState().setIsConnected(false))
  expect(useAppStore.getState().isConnected).toBe(false)
})

test('openAdminModal sets showAdminModal=true and stores action', () => {
  const { result } = renderHook(() => useAppStore())
  const action = vi.fn()
  act(() => result.current.openAdminModal(action))
  expect(result.current.showAdminModal).toBe(true)
  expect(result.current.pendingAdminAction).toBe(action)
})

test('closeAdminModal resets modal state', () => {
  const { result } = renderHook(() => useAppStore())
  act(() => {
    result.current.openAdminModal(vi.fn())
    result.current.closeAdminModal()
  })
  expect(result.current.showAdminModal).toBe(false)
  expect(result.current.pendingAdminAction).toBeNull()
})
