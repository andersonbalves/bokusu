import { render, screen, fireEvent } from '@testing-library/react'
import { EditMetadataModal } from './EditMetadataModal'
import { vi, test, expect } from 'vitest'

test('splits display name on dash and populates fields', () => {
  render(
    <EditMetadataModal
      open={true}
      displayName="Queen - Bohemian Rhapsody"
      onClose={() => {}}
      onSave={() => {}}
    />
  )
  expect(screen.getByPlaceholderText(/queen/i)).toHaveValue('Queen')
  expect(screen.getByPlaceholderText(/bohemian/i)).toHaveValue('Bohemian Rhapsody')
})

test('calls onSave with combined name on submit', () => {
  const onSave = vi.fn()
  render(
    <EditMetadataModal
      open={true}
      displayName="Bohemian Rhapsody"
      onClose={() => {}}
      onSave={onSave}
    />
  )
  const artistInput = screen.getByPlaceholderText(/queen/i)
  const titleInput = screen.getByPlaceholderText(/bohemian/i)

  fireEvent.change(artistInput, { target: { value: 'ABBA' } })
  fireEvent.change(titleInput, { target: { value: 'Waterloo' } })
  fireEvent.submit(screen.getByRole('button', { name: /confirmar|confirm/i }))

  expect(onSave).toHaveBeenCalledWith('ABBA - Waterloo')
})
