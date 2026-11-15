/* Telegram alert phone mock-up + control panel preview. */

const TG_LINES = [
  ['🏢', 'Acme Manufacturing'],
  ['📷', 'Camera: Workshop 2'],
  ['📍', 'Location: Building A'],
  ['📅', '16.11.2026   🕒 14:32:07'],
  ['🎯', 'Confidence: 87%'],
  ['👥', 'People in frame: 3'],
]

export function TelegramShowcase() {
  return (
    <section className="lsection sheet sheet--mint" id="alerts">
      <div className="lwrap split">
        <div className="split__copy reveal">
          <span className="kicker">Instant alerts</span>
          <h2>The right people know within seconds</h2>
          <p>
            Every incident goes straight to your managers’ Telegram, with the annotated snapshot and the facts they need
            to act, so nobody has to watch screens all day.
          </p>
          <ul className="checklist">
            <li>Snapshot with the AI’s boxes drawn on it</li>
            <li>Camera, location, date, time and confidence</li>
            <li>Choose which incident types each team receives</li>
            <li>Set up in the app in three steps, no config files</li>
          </ul>
        </div>
        <div className="phone reveal" style={{ '--d': '120ms' }}>
          <div className="phone__notch" />
          <div className="phone__bar">
            <span className="phone__avatar">JS</span>
            <div>
              <b>JobSaver Bot</b>
              <span>bot</span>
            </div>
          </div>
          <div className="phone__chat">
            <div className="bubble">
              <div className="bubble__img" aria-hidden="true">
                <span className="bubble__box">NO HELMET 87%</span>
              </div>
              <p className="bubble__title">⚠️ <b>No helmet</b></p>
              <p className="bubble__sub">Safety violation</p>
              {TG_LINES.map(([icon, text]) => (
                <p key={text} className="bubble__line"><span>{icon}</span>{text}</p>
              ))}
              <p className="bubble__line"><span>🆔</span>Event #128</p>
              <span className="bubble__time">14:32</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const BARS = [3, 5, 2, 6, 4, 1, 3]

export function DashboardPreview() {
  return (
    <section className="lsection sheet sheet--white">
      <div className="lwrap">
        <div className="lhead reveal">
          <span className="kicker">Control panel</span>
          <h2>One dashboard for the whole site</h2>
          <p>Live cameras, a violations journal, an emergency log and weekly trends, filterable by incident type.</p>
        </div>
        <div className="window reveal" aria-hidden="true">
          <div className="window__bar"><i /><i /><i /><span>JobSaver · Overview</span></div>
          <div className="window__body">
            <aside className="window__side">
              <div className="window__brand"><span className="window__mark" /> JobSaver</div>
              {['Overview', 'Cameras', 'Violations', 'Emergency calls', 'Settings'].map((n, i) => (
                <span key={n} className={`window__nav${i === 0 ? ' window__nav--on' : ''}`}>
                  {n}
                  {n === 'Violations' && <b>3</b>}
                </span>
              ))}
            </aside>
            <div className="window__main">
              <div className="window__chips">
                {['All', 'No helmet', 'Danger zone', 'Person down'].map((c, i) => (
                  <span key={c} className={i === 0 ? 'on' : ''}>{c}</span>
                ))}
              </div>
              <div className="window__stats">
                {[['2/2', 'Cameras online'], ['3', 'Violations today', 'warn'], ['0', 'Emergencies today'], ['1', 'Unhandled']].map(([v, l, tone]) => (
                  <div key={l} className={`window__stat${tone ? ` window__stat--${tone}` : ''}`}><b>{v}</b><span>{l}</span></div>
                ))}
              </div>
              <div className="window__row">
                <div className="window__chart">
                  <span className="window__label">Incidents, last 7 days</span>
                  <div className="window__bars">
                    {BARS.map((h, i) => (
                      <i key={i} style={{ '--h': `${(h / 6) * 100}%`, '--d': `${i * 70}ms` }} />
                    ))}
                  </div>
                </div>
                <div className="window__events">
                  <span className="window__label">Recent events</span>
                  {[['warn', 'No helmet', 'Workshop 2 · 14:32'], ['warn', 'Danger zone entry', 'Loading bay · 13:05'], ['danger', 'Person down', 'Warehouse · Mon']].map(([tone, a, b]) => (
                    <div key={a} className="window__event"><i className={`dot dot--${tone}`} /><b>{a}</b><span>{b}</span></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
