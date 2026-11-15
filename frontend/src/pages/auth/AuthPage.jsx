import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { LogoMark } from '../../components/Logo.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { t } from '../../lib/strings.js'
import './auth.css'

const EMAIL_RE = /^\S+@\S+\.\S+$/

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 3 18 18" />
      <path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.9 3.9" />
      <path d="M6.6 6.6C3.8 8.5 2 12 2 12s3.5 7 10 7c1.4 0 2.7-.3 3.8-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  )
}

function PasswordInput({ id, value, onChange, placeholder, autoComplete, t }) {
  const [show, setShow] = useState(false)
  return (
    <div className="password-wrap">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="eye"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        aria-label={show ? t.hidePassword : t.showPassword}
      >
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
}

function Field({ label, htmlFor, error, right, children }) {
  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <div className="field__top">
        <label htmlFor={htmlFor}>{label}</label>
        {right}
      </div>
      {children}
      <p className="field__error" aria-live="polite">{error || '\u00A0'}</p>
    </div>
  )
}

export default function AuthPage({ mode }) {
  const { status, login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [height, setHeight] = useState(null)
  const [data, setData] = useState({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [result, setResult] = useState(null) // 'register' | null
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  const loginRef = useRef(null)
  const registerRef = useRef(null)
  const successRef = useRef(null)

  const activeRef = result
    ? successRef
    : mode === 'login'
      ? loginRef
      : registerRef

  useEffect(() => {
    const measure = () => {
      if (activeRef.current) setHeight(activeRef.current.offsetHeight)
    }
    const raf = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-measure when the visible form changes
  }, [mode, result, formError])

  const switchMode = (next) => {
    if (next === mode) return
    navigate(next === 'login' ? '/login' : '/register', { replace: true })
    setErrors({})
    setFormError('')
  }

  const setField = (field) => (e) => {
    const value = e.target.value
    setData((d) => ({ ...d, [field]: value }))
    if (errors[field]) setErrors((er) => ({ ...er, [field]: undefined }))
    if (formError) setFormError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (busy) return
    const er = {}
    if (mode === 'register' && !data.name.trim()) er.name = t.errorName
    if (!EMAIL_RE.test(data.email.trim())) er.email = t.errorEmail
    if (data.password.length < 6) er.password = t.errorPassword
    setErrors(er)
    setFormError('')
    if (Object.keys(er).length > 0) return

    setBusy(true)
    try {
      if (mode === 'login') {
        await login(data.email.trim(), data.password)
        navigate(location.state?.from || '/app', { replace: true })
      } else {
        await register(data.name.trim(), data.email.trim(), data.password)
        setResult('register')
      }
    } catch (err) {
      if (err.detail === 'email_taken') setErrors({ email: t.errorEmailTaken })
      else if (err.detail === 'invalid_credentials') setFormError(t.errorInvalidCredentials)
      else if (err.status === 0) setFormError(t.errorNetwork)
      else setFormError(t.errorGeneric)
    } finally {
      setBusy(false)
    }
  }

  const goToLogin = () => {
    setResult(null)
    setErrors({})
    setData((d) => ({ ...d, password: '' }))
    navigate('/login', { replace: true })
  }

  const isLogin = mode === 'login'

  if (status === 'loading') return null
  if (status === 'authed') return <Navigate to="/app" replace />

  return (
    <div className="page">
      <Link to="/" className="back-home">← {t.backHome}</Link>

      <main className="card">
        <div className="brand">
          <LogoMark />
          <h1 className="brand__name">JobSaver</h1>
          <p className="brand__tagline">
            {isLogin ? t.taglineLogin : t.taglineRegister}
          </p>
        </div>

        <div className="tabs" role="tablist" aria-label={t.panelNav}>
          <span className={`tabs__pill${isLogin ? '' : ' tabs__pill--shift'}`} aria-hidden="true" />
          <button
            type="button"
            role="tab"
            aria-selected={isLogin}
            className={`tab${isLogin ? ' tab--active' : ''}`}
            onClick={() => switchMode('login')}
          >
            {t.tabLogin}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isLogin}
            className={`tab${!isLogin ? ' tab--active' : ''}`}
            onClick={() => switchMode('register')}
          >
            {t.tabRegister}
          </button>
        </div>

        <div className="forms" style={height != null ? { height } : undefined}>
          <form
            ref={loginRef}
            noValidate
            className={`form${isLogin && !result ? ' form--active' : ' form--hidden-left'}`}
            onSubmit={handleSubmit}
          >
            <Field label={t.email} htmlFor="login-email" error={errors.email}>
              <input
                id="login-email"
                type="email"
                value={data.email}
                onChange={setField('email')}
                placeholder={t.placeholderEmail}
                autoComplete="email"
              />
            </Field>
            <Field
              label={t.password}
              htmlFor="login-password"
              error={errors.password}
              right={<a className="link" href="#" onClick={(e) => e.preventDefault()}>{t.forgot}</a>}
            >
              <PasswordInput
                id="login-password"
                value={data.password}
                onChange={setField('password')}
                placeholder={t.placeholderPassword}
                autoComplete="current-password"
                t={t}
              />
            </Field>
            {formError && isLogin && <p className="form__error" role="alert">{formError}</p>}
            <button type="submit" className="btn" disabled={busy}>{busy ? t.loading : t.signIn}</button>
          </form>

          <form
            ref={registerRef}
            noValidate
            className={`form${!isLogin && !result ? ' form--active' : ' form--hidden-right'}`}
            onSubmit={handleSubmit}
          >
            <Field label={t.name} htmlFor="reg-name" error={errors.name}>
              <input
                id="reg-name"
                type="text"
                value={data.name}
                onChange={setField('name')}
                placeholder={t.placeholderName}
                autoComplete="name"
              />
            </Field>
            <Field label={t.email} htmlFor="reg-email" error={errors.email}>
              <input
                id="reg-email"
                type="email"
                value={data.email}
                onChange={setField('email')}
                placeholder={t.placeholderEmail}
                autoComplete="email"
              />
            </Field>
            <Field label={t.password} htmlFor="reg-password" error={errors.password}>
              <PasswordInput
                id="reg-password"
                value={data.password}
                onChange={setField('password')}
                placeholder={t.placeholderPasswordNew}
                autoComplete="new-password"
                t={t}
              />
            </Field>
            {formError && !isLogin && <p className="form__error" role="alert">{formError}</p>}
            <button type="submit" className="btn" disabled={busy}>{busy ? t.loading : t.createAccount}</button>
          </form>

          <div ref={successRef} className={`success${result ? ' success--active' : ''}`}>
            <div className="success__icon" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h2 className="success__title">{t.accountCreated}</h2>
            <p className="success__text">{t.accountCreatedText}</p>
            <button type="button" className="btn btn--ghost" onClick={goToLogin}>
              {t.signIn}
            </button>
          </div>
        </div>
      </main>

      <footer className="foot">{t.copyright}</footer>
    </div>
  )
}
