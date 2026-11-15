import { DETECTIONS, SOURCES, STATS, STEPS } from '../content.js'

const ICONS = {
  helmet: <path d="M4 15a8 8 0 0 1 16 0M2 15h20v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1zM12 7v4M9 8.5l1 3M15 8.5l-1 3" />,
  zone: <><path d="M4 7 12 3l8 4v10l-8 4-8-4z" /><path d="M12 9v4M12 16.5v.01" /></>,
  down: <><circle cx="6" cy="16" r="2" /><path d="M9 17h11M8 13l4-3 5 3M3 21h18" /></>,
  fire: <path d="M12 3s5 4.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 1.5-4S9 12 11 12c0-4 1-9 1-9Z" />,
  vest: <path d="M8 3 5 5v15h5v-6h4v6h5V5l-3-2-2 4h-4zM5 11h14" />,
  sos: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.01" /></>,
  webcam: <><circle cx="12" cy="10" r="6" /><circle cx="12" cy="10" r="2" /><path d="M8 21h8M12 16v5" /></>,
  phone: <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>,
  cctv: <><path d="M3 7l13-3 2 7-13 3zM9 13l1 5M5 18h8" /><path d="M18 9l3 1" /></>,
  file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M10 12l4 2.5-4 2.5z" /></>,
}

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

export function Stats() {
  return (
    <section className="stats-band">
      <div className="lwrap stats-band__grid">
        {STATS.map((s, i) => (
          <div key={s.label} className="stats-band__item reveal" style={{ '--d': `${i * 80}ms` }}>
            <span className="stats-band__value">{s.value}</span>
            <span className="stats-band__label">{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

export function Features() {
  return (
    <section className="lsection sheet sheet--white" id="features">
      <div className="lwrap">
        <div className="lhead reveal">
          <span className="kicker">What it detects</span>
          <h2>Six ways JobSaver keeps your people safe</h2>
          <p>Turn each detection on or off in Settings. They run on every camera at once.</p>
        </div>
        <div className="fgrid">
          {DETECTIONS.map((d, i) => (
            <article key={d.key} className="fcard reveal" style={{ '--d': `${(i % 3) * 90}ms` }}>
              <div className={`fcard__icon fcard__icon--${d.tone}`}><Icon name={d.key} /></div>
              <h3>{d.title}</h3>
              <p>{d.text}</p>
              <span className={`fcard__tag fcard__tag--${d.tone}`}>{d.tag}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function HowItWorks() {
  return (
    <section className="lsection sheet sheet--dark" id="how">
      <div className="lwrap">
        <div className="lhead reveal">
          <span className="kicker">How it works</span>
          <h2>From camera to manager in four steps</h2>
          <p>No cloud account, no training data, no special hardware.</p>
        </div>
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="steps__item reveal" style={{ '--d': `${i * 110}ms` }}>
              <span className="steps__num">{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function Sources() {
  return (
    <section className="lsection sheet sheet--mint">
      <div className="lwrap">
        <div className="lhead reveal">
          <span className="kicker">Bring your own cameras</span>
          <h2>Works with the cameras you already have</h2>
        </div>
        <div className="sgrid">
          {SOURCES.map((s, i) => (
            <div key={s.title} className="scard reveal" style={{ '--d': `${i * 80}ms` }}>
              <div className="scard__icon"><Icon name={['webcam', 'phone', 'cctv', 'file'][i]} /></div>
              <div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
