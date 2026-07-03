import { render, screen, fireEvent } from '@testing-library/react'
import { SearchResultItem } from './SearchResultItem'
import type { SearchResult } from '../types/api'
import { vi, test, expect } from 'vitest'

const result: SearchResult = { id: 'abc', title: 'Cool Song', url: 'https://youtube.com/watch?v=abc' }

test('renders title', () => {
  render(<SearchResultItem result={result} onAdd={() => {}} onPreview={() => {}} isAdding={false} />)
  expect(screen.getByText('Cool Song')).toBeInTheDocument()
})

test('calls onAdd when add button clicked', () => {
  const onAdd = vi.fn()
  render(<SearchResultItem result={result} onAdd={onAdd} onPreview={() => {}} isAdding={false} />)
  fireEvent.click(screen.getByRole('button', { name: /adicionar/i }))
  expect(onAdd).toHaveBeenCalledWith(true)
})

test('add button is disabled when isAdding=true', () => {
  render(<SearchResultItem result={result} onAdd={() => {}} onPreview={() => {}} isAdding={true} />)
  expect(screen.getByRole('button', { name: /adicionar/i })).toBeDisabled()
})
