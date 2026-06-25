import { describe, it, expect, vi } from 'vitest'
import { apiFetch } from './api'

global.fetch = vi.fn()

describe('apiFetch', () => {
  it('should call fetch with JSON headers and stringify body', async () => {
    const mockResponse = { ok: true, json: () => Promise.resolve({ data: 'ok' }) }
    ;(global.fetch as any).mockResolvedValue(mockResponse)

    const data = await apiFetch('/api/test', { method: 'POST', body: { id: 1 } })
    
    expect(global.fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 1 })
    }))
    expect(data).toEqual({ data: 'ok' })
  })
})
