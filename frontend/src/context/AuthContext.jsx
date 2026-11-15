import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, getToken, setToken, setUnauthorizedHandler } from '../lib/api.js'

const AuthContext = createContext(null)

/**
 * Session state for the whole app.
 * status: 'loading' (checking a saved token) | 'authed' | 'anon'
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState(() => (getToken() ? 'loading' : 'anon'))

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    setStatus('anon')
  }, [])

  // Restore a saved session; drop it whenever the server rejects the token.
  useEffect(() => {
    setUnauthorizedHandler(logout)
    if (!getToken()) return
    api
      .me()
      .then((u) => {
        setUser(u)
        setStatus('authed')
      })
      .catch(logout)
  }, [logout])

  const login = useCallback(async (email, password) => {
    const res = await api.login(email, password)
    setToken(res.token)
    setUser(res.user)
    setStatus('authed')
    return res.user
  }, [])

  const register = useCallback((name, email, password) => api.register(name, email, password), [])

  const value = useMemo(() => ({ user, status, login, register, logout }), [user, status, login, register, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
