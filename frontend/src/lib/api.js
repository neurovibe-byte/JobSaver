// Thin client for the FastAPI backend. In dev, Vite proxies /api to http://localhost:8000.
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const TOKEN_KEY = 'jobsaver.token'

export class ApiError extends Error {
  constructor(status, detail) {
    super(typeof detail === 'string' ? detail : `HTTP ${status}`)
    this.status = status
    this.detail = detail
  }
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable */
  }
}

let onUnauthorized = () => {}
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn
}

async function request(path, { method = 'GET', body, form } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let payload
  if (form) payload = form
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  let res
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: payload })
  } catch {
    throw new ApiError(0, 'network')
  }
  if (res.status === 401 && token) onUnauthorized()
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data?.detail ?? null)
  return data
}

/** URL usable in <img src> (adds the token as a query param). */
export function mediaUrl(path, bust) {
  const q = new URLSearchParams({ token: getToken() || '' })
  if (bust) q.set('t', bust)
  return `${BASE}${path}?${q}`
}

export const api = {
  register: (name, email, password) =>
    request('/api/auth/register', { method: 'POST', body: { name, email, password } }),
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/api/auth/me'),

  stats: (type) => request(`/api/stats${type ? `?type=${encodeURIComponent(type)}` : ''}`),

  cameras: () => request('/api/cameras'),
  addCamera: (name, source, location = '') =>
    request('/api/cameras', { method: 'POST', body: { name, source, location } }),
  uploadCamera: (name, file, location = '') => {
    const form = new FormData()
    form.append('name', name)
    form.append('location', location)
    form.append('file', file)
    return request('/api/cameras/upload', { method: 'POST', form })
  },
  updateCamera: (id, patch) => request(`/api/cameras/${id}`, { method: 'PATCH', body: patch }),
  deleteCamera: (id) => request(`/api/cameras/${id}`, { method: 'DELETE' }),

  events: (category, limit = 100, type) =>
    request(`/api/events?${new URLSearchParams({ limit, ...(category ? { category } : {}), ...(type ? { type } : {}) })}`),
  ack: (id) => request(`/api/events/${id}/ack`, { method: 'POST' }),
  sos: (cameraId, note) =>
    request('/api/events/sos', { method: 'POST', body: { camera_id: cameraId || null, note: note || null } }),

  settings: () => request('/api/settings'),
  saveSettings: (patch) => request('/api/settings', { method: 'PUT', body: patch }),

  telegramTest: () => request('/api/telegram/test', { method: 'POST' }),
  telegramConnect: (token) => request('/api/telegram/connect', { method: 'POST', body: { token } }),
  telegramDisconnect: () => request('/api/telegram/disconnect', { method: 'POST' }),
  telegramDiscover: () => request('/api/telegram/chats/discover'),
  telegramAddChat: (id, name) => request('/api/telegram/chats', { method: 'POST', body: { id: String(id), name } }),
  telegramRemoveChat: (id) => request(`/api/telegram/chats/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  telegramPrefs: (prefs) => request('/api/telegram/prefs', { method: 'PUT', body: prefs }),
}
