import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AdminModal } from './AdminModal'
import { useAppStore } from '../store/useAppStore'

beforeEach(() => {
  useAppStore.setState({
    showAdminModal: true,
    pendingAdminAction: null,
    isAdmin: false,
  })
})

test('renders password input when modal is open', () => {
  render(<AdminModal />)
  expect(screen.getByPlaceholderText(/senha/i)).toBeInTheDocument()
})

test('does not render when showAdminModal=false', () => {
  useAppStore.setState({ showAdminModal: false })
  render(<AdminModal />)
  expect(screen.queryByPlaceholderText(/senha/i)).not.toBeInTheDocument()
})

test('cancel closes modal without calling pendingAdminAction', () => {
  const action = vi.fn()
  useAppStore.setState({ pendingAdminAction: action })
  render(<AdminModal />)
  fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))
  expect(useAppStore.getState().showAdminModal).toBe(false)
  expect(action).not.toHaveBeenCalled()
})

test('correct password sets isAdmin=true and calls pendingAdminAction', async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
  const action = vi.fn()
  useAppStore.setState({ pendingAdminAction: action })
  render(<AdminModal />)
  fireEvent.change(screen.getByPlaceholderText(/senha/i), { target: { value: 'secret' } })
  fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))
  await waitFor(() => expect(useAppStore.getState().isAdmin).toBe(true))
  expect(action).toHaveBeenCalledTimes(1)
  expect(useAppStore.getState().showAdminModal).toBe(false)
})

test('wrong password shows error message and does not set isAdmin', async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) })
  render(<AdminModal />)
  fireEvent.change(screen.getByPlaceholderText(/senha/i), { target: { value: 'wrong' } })
  fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))
  await waitFor(() => expect(screen.getByText(/senha incorreta/i)).toBeInTheDocument())
  expect(useAppStore.getState().isAdmin).toBe(false)
})
