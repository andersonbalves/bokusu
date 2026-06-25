import { render, screen, fireEvent } from '@testing-library/react'
import { SearchResultItem } from './SearchResultItem'
import type { SearchResult } from '../types/api'

const result: SearchResult = { id: 'abc', title: 'Cool Song', artist: 'DJ Test' }

test('renders title and artist', () => {
  render(<SearchResultItem result={result} onAdd={() => {}} isAdding={false} />)
  expect(screen.getByText('Cool Song')).toBeInTheDocument()
  expect(screen.getByText('DJ Test')).toBeInTheDocument()
})

test('calls onAdd when add button clicked', () => {
  const onAdd = vi.fn()
  render(<SearchResultItem result={result} onAdd={onAdd} isAdding={false} />)
  fireEvent.click(screen.getByRole('button', { name: /adicionar/i }))
  expect(onAdd).toHaveBeenCalledTimes(1)
})

test('add button is disabled when isAdding=true', () => {
  render(<SearchResultItem result={result} onAdd={() => {}} isAdding={true} />)
  expect(screen.getByRole('button', { name: /adicionar/i })).toBeDisabled()
})
