import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AdminModal } from './AdminModal'
import { useAppStore } from '../store/useAppStore'
import { vi, afterEach } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
})

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
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ isAdmin: true }), { status: 200 })
  )
  vi.stubGlobal('fetch', fetchMock)
  const action = vi.fn()
  useAppStore.setState({ pendingAdminAction: action })
  render(<AdminModal />)
  fireEvent.change(screen.getByPlaceholderText(/senha/i), { target: { value: 'secret' } })
  fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))
  await waitFor(() => expect(useAppStore.getState().isAdmin).toBe(true))
  expect(action).toHaveBeenCalledTimes(1)
  expect(useAppStore.getState().showAdminModal).toBe(false)
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/auth',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ password: 'secret' }),
    })
  )
})

test('wrong password shows error message and does not set isAdmin', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ error: 'Senha incorreta' }), { status: 403 })
  )
  vi.stubGlobal('fetch', fetchMock)
  render(<AdminModal />)
  fireEvent.change(screen.getByPlaceholderText(/senha/i), { target: { value: 'wrong' } })
  fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))
  await waitFor(() => expect(screen.getByText(/senha incorreta/i)).toBeInTheDocument())
  expect(useAppStore.getState().isAdmin).toBe(false)
  expect(useAppStore.getState().showAdminModal).toBe(true)
})

test('cannot cancel and cancel button is disabled while auth is pending', async () => {
  let resolveFetch: (value: Response) => void = () => {}
  const fetchPromise = new Promise<Response>((resolve) => {
    resolveFetch = resolve
  })
  const fetchMock = vi.fn().mockReturnValue(fetchPromise)
  vi.stubGlobal('fetch', fetchMock)

  render(<AdminModal />)
  fireEvent.change(screen.getByPlaceholderText(/senha/i), { target: { value: 'secret' } })
  fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))

  // At this point, the fetch is pending.
  const cancelBtn = screen.getByRole('button', { name: /cancelar/i })
  expect(cancelBtn).toBeDisabled()

  // Clicking cancel should not close the modal
  fireEvent.click(cancelBtn)
  expect(useAppStore.getState().showAdminModal).toBe(true)

  // Resolve fetch to clean up
  resolveFetch(new Response(JSON.stringify({ isAdmin: true }), { status: 200 }))
  await waitFor(() => expect(useAppStore.getState().showAdminModal).toBe(false))
})

test('does not submit duplicate requests if already pending', async () => {
  let resolveFetch: (value: Response) => void = () => {}
  const fetchPromise = new Promise<Response>((resolve) => {
    resolveFetch = resolve
  })
  const fetchMock = vi.fn().mockReturnValue(fetchPromise)
  vi.stubGlobal('fetch', fetchMock)

  render(<AdminModal />)
  const input = screen.getByPlaceholderText(/senha/i)
  fireEvent.change(input, { target: { value: 'secret' } })

  // Submit first time
  fireEvent.keyDown(input, { key: 'Enter' })
  // Try to submit second time immediately
  fireEvent.keyDown(input, { key: 'Enter' })
  fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))

  expect(fetchMock).toHaveBeenCalledTimes(1)

  // Resolve fetch to clean up
  resolveFetch(new Response(JSON.stringify({ isAdmin: true }), { status: 200 }))
  await waitFor(() => expect(useAppStore.getState().showAdminModal).toBe(false))
})
