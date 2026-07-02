export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  const response = await fetch(endpoint, { ...options, headers })

  if (!response.ok) {
    let message = `API error: ${response.status} ${response.statusText}`
    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // corpo não-JSON: mantém a mensagem genérica
    }
    throw new ApiError(response.status, message)
  }

  if (response.status === 204) {
    return null as T
  }

  return response.json() as Promise<T>
}
