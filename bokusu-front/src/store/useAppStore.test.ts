import { renderHook, act } from '@testing-library/react'
import { useAppStore } from './useAppStore'

beforeEach(() => {
  useAppStore.setState({
    theme: 'aqua',
    isAdmin: false,
    playerMode: 'integration',
    showAdminModal: false,
    pendingAdminAction: null,
  })
})

test('playerMode defaults to integration', () => {
  const { result } = renderHook(() => useAppStore())
  expect(result.current.playerMode).toBe('integration')
})

test('setPlayerMode updates playerMode', () => {
  const { result } = renderHook(() => useAppStore())
  act(() => result.current.setPlayerMode('cinematic'))
  expect(result.current.playerMode).toBe('cinematic')
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
