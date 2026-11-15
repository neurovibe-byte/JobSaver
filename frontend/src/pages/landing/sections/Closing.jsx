import { Link } from 'react-router-dom'
import Logo from '../../../components/Logo.jsx'
import { useAuth } from '../../../context/AuthContext.jsx'
import { FAQ, NAV_LINKS } from '../content.js'

export function Faq() {
  return (
    <section className="lsection sheet sheet--white" id="faq">
      <div className="lwrap lwrap--narrow">
        <div className="lhead reveal">
          <span className="kicker">FAQ</span>
          <h2>Questions, answered</h2>
        </div>
        <div className="faq">
          {FAQ.map((f, i) => (
            <details key={f.q} className="faq__item reveal" style={{ '--d': `${i * 60}ms` }}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

export function CallToAction() {
  const { status } = useAuth()
  return (
    <section className="cta sheet sheet--mint">
      <div className="lwrap cta__inner reveal">
        <h2>Start protecting your team today</h2>
        <p>Connect a camera in under a minute. Free, private and running on your own hardware.</p>
        <div className="cta__actions">
          <Link to={status === 'authed' ? '/app' : '/register'} className="lbtn lbtn--light lbtn--lg">
            {status === 'authed' ? 'Open dashboard' : 'Create a free account'}
          </Link>
          {status !== 'authed' && <Link to="/login" className="lbtn lbtn--outline-light lbtn--lg">Sign in</Link>}
        </div>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="lfoot sheet sheet--ink">
      <div className="lwrap lfoot__inner">
        <div className="lfoot__brand">
          <Logo />
          <p>AI eyes on every worksite: spot safety violations and emergencies instantly.</p>
        </div>
        <nav className="lfoot__links" aria-label="Footer">
          {NAV_LINKS.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
          <Link to="/login">Sign in</Link>
        </nav>
      </div>
      <div className="lwrap lfoot__bottom">© 2026 JobSaver</div>
    </footer>
  )
}
