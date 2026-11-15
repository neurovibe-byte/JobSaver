import { Link } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext.jsx'
import LiveDemo from './LiveDemo.jsx'

export default function Hero() {
  const { status } = useAuth()
  return (
    <section className="hero" id="top">
      <div className="hero__glow hero__glow--a" aria-hidden="true" />
      <div className="hero__glow hero__glow--b" aria-hidden="true" />
      <div className="lwrap hero__grid">
        <div className="hero__copy">
          <span className="eyebrow">
            <span className="eyebrow__dot" /> AI workplace safety · free &amp; self-hosted
          </span>
          <h1 className="hero__title">
            See the risk.
            <br />
            Alert the team.
            <br />
            <span className="grad-text">Save the job.</span>
          </h1>
          <p className="hero__lead">
            JobSaver turns the cameras you already have into a safety officer that never blinks. It spots missing
            helmets, people in danger zones and workers who have fallen, then alerts managers on Telegram with a
            snapshot in seconds.
          </p>
          <div className="hero__actions">
            <Link to={status === 'authed' ? '/app' : '/register'} className="lbtn lbtn--primary lbtn--lg">
              {status === 'authed' ? 'Open dashboard' : 'Start monitoring free'}
              <span aria-hidden="true">→</span>
            </Link>
            <a href="#how" className="lbtn lbtn--ghost lbtn--lg">See how it works</a>
          </div>
          <ul className="hero__trust">
            <li>Works with webcams, phones &amp; CCTV</li>
            <li>Video stays on your network</li>
            <li>No model training needed</li>
          </ul>
        </div>
        <div className="hero__visual">
          <LiveDemo />
        </div>
      </div>
    </section>
  )
}
