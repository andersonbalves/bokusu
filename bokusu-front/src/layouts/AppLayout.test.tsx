/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { useAppStore } from '../store/useAppStore'

describe('AppLayout', () => {
  beforeEach(() => {
    useAppStore.setState({ isConnected: true })
  })

  it('shows connection error banner when disconnected', () => {
    useAppStore.setState({ isConnected: false })

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    )

    expect(screen.getByText('Sem conexão com o servidor')).not.toBeNull()
  })

  it('hides connection error banner when connected', () => {
    useAppStore.setState({ isConnected: true })

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    )

    expect(screen.queryByText('Sem conexão com o servidor')).toBeNull()
  })
})