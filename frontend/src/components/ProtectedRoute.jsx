import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

/** Renders children only for signed-in users; otherwise sends them to /login. */
export default function ProtectedRoute({ children }) {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return null
  if (status !== 'authed') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}
