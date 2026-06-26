export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  const body = options.body && typeof options.body === 'object' && !(options.body instanceof FormData) 
    ? JSON.stringify(options.body) 
    : (options.body as BodyInit | null | undefined)

  const response = await fetch(endpoint, {
    ...options,
    headers,
    body,
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}
