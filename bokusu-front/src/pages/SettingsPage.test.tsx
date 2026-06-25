import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsPage } from './SettingsPage'
import { useAppStore } from '../store/useAppStore'

beforeEach(() => {
  useAppStore.setState({ theme: 'aqua', playerMode: 'integration', isAdmin: false })
})

test('renders theme and TV mode sections', () => {
  render(<SettingsPage />)
  expect(screen.getByText(/tema/i)).toBeInTheDocument()
  expect(screen.getByText(/modo da tv/i)).toBeInTheDocument()
})

test('clicking Acid radio updates store theme to acid', () => {
  render(<SettingsPage />)
  fireEvent.click(screen.getByRole('radio', { name: /^acid$/i }))
  expect(useAppStore.getState().theme).toBe('acid')
})

test('clicking Cinemático radio updates store playerMode to cinematic', () => {
  render(<SettingsPage />)
  fireEvent.click(screen.getByRole('radio', { name: /cinemático/i }))
  expect(useAppStore.getState().playerMode).toBe('cinematic')
})

test('shows admin login button when not admin', () => {
  render(<SettingsPage />)
  expect(screen.getByRole('button', { name: /entrar como admin/i })).toBeInTheDocument()
})

test('shows logout button when isAdmin=true', () => {
  useAppStore.setState({ isAdmin: true })
  render(<SettingsPage />)
  expect(screen.getByRole('button', { name: /sair do modo admin/i })).toBeInTheDocument()
})
