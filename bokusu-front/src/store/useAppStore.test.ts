import { renderHook, act } from '@testing-library/react'
import { useAppStore } from './useAppStore'

beforeEach(() => {
  useAppStore.setState({
    theme: 'aqua',
    isAdmin: false,
    isConnected: true,
    showAdminModal: false,
    pendingAdminAction: null,
    toasts: [],
  })
})

test('pushToast appends a toast and dismissToast removes it', () => {
  const store = useAppStore.getState()
  expect(store.toasts).toEqual([])

  act(() => store.pushToast('Hello', 'info'))
  expect(useAppStore.getState().toasts).toEqual([
    { id: expect.any(Number), message: 'Hello', severity: 'info' }
  ])

  const id = useAppStore.getState().toasts[0].id
  act(() => useAppStore.getState().dismissToast(id))
  expect(useAppStore.getState().toasts).toEqual([])
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
