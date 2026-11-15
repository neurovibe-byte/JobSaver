import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../../../components/Logo.jsx'
import { useAuth } from '../../../context/AuthContext.jsx'
import { NAV_LINKS } from '../content.js'

export default function Navbar() {
  const { status } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`lnav${scrolled ? ' lnav--scrolled' : ''}${open ? ' lnav--open' : ''}`}>
      <div className="lnav__inner">
        <a href="#top" className="lnav__logo" onClick={() => setOpen(false)}>
          <Logo />
        </a>
        <nav className="lnav__links" aria-label="Main">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</a>
          ))}
        </nav>
        <div className="lnav__cta">
          {status === 'authed' ? (
            <Link to="/app" className="lbtn lbtn--primary">Open dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="lbtn lbtn--ghost">Sign in</Link>
              <Link to="/register" className="lbtn lbtn--primary">Get started</Link>
            </>
          )}
        </div>
        <button type="button" className="lnav__burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span /><span /><span />
        </button>
      </div>
    </header>
  )
}
