import { describe, it, expect, vi } from 'vitest'
import { apiFetch, ApiError } from './api'

globalThis.fetch = vi.fn() as unknown as typeof fetch

describe('apiFetch', () => {
  it('should call fetch with JSON headers', async () => {
    const mockResponse = { ok: true, json: () => Promise.resolve({ data: 'ok' }) }
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as unknown as Response)

    const data = await apiFetch('/api/test', { method: 'POST', body: JSON.stringify({ id: 1 }) })

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 1 })
    }))
    expect(data).toEqual({ data: 'ok' })
  })

  it('throws ApiError with server-provided message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 })
      )
    )
    await expect(apiFetch('/api/queue')).rejects.toMatchObject({
      status: 403,
      message: 'Unauthorized',
    })
  })

  it('throws ApiError with generic message when body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('boom', { status: 500 }))
    )
    await expect(apiFetch('/api/queue')).rejects.toBeInstanceOf(ApiError)
  })
})
