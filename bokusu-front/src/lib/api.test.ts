import { describe, it, expect, vi } from 'vitest'
import { apiFetch } from './api'

globalThis.fetch = vi.fn() as unknown as typeof fetch

describe('apiFetch', () => {
  it('should call fetch with JSON headers and stringify body', async () => {
    const mockResponse = { ok: true, json: () => Promise.resolve({ data: 'ok' }) }
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as unknown as Response)

    const data = await apiFetch('/api/test', { method: 'POST', body: { id: 1 } as unknown as BodyInit })

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 1 })
    }))
    expect(data).toEqual({ data: 'ok' })
  })
})
