const BASE = '/api'

export class ApiError extends Error {
  status: number
  data: Record<string, unknown>

  constructor(status: number, data: Record<string, unknown>) {
    super((data.message as string) ?? 'Erreur API')
    this.status = status
    this.data = data
  }
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('token')

  // Sur un envoi multipart (upload de fichier), le navigateur doit poser lui-même
  // Content-Type avec sa boundary : le forcer à application/json casserait la requête.
  const isMultipart = options.body instanceof FormData

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(isMultipart ? {} : { 'Content-Type': 'application/json' }),
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string>),
    },
  })

  if (res.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/login'
    throw new ApiError(401, { message: 'Non authentifié' })
  }

  return res
}
