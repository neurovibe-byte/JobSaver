import { useState } from 'react'
import { api } from '../../lib/api.js'
import { usePolling } from '../../hooks/usePolling.js'
import { typeLabel, formatTime } from '../../lib/format.js'
import { EMERGENCY_TYPES, TypeChips, VIOLATION_TYPES } from './common.jsx'

function StatTile({ label, value, tone }) {
  return (
    <div className={`stat${tone ? ` stat--${tone}` : ''}`}>
      <span className="stat__value">{value ?? '—'}</span>
      <span className="stat__label">{label}</span>
    </div>
  )
}

function WeekChart({ daily, t }) {
  const max = Math.max(1, ...daily.map((d) => d.violation + d.emergency))
  return (
    <div className="card-box">
      <div className="card-box__head">
        <h3>{t.weekChart}</h3>
        <div className="legend">
          <span className="legend__item"><i className="legend__dot legend__dot--v" />{t.tabViolations}</span>
          <span className="legend__item"><i className="legend__dot legend__dot--e" />{t.emergencies}</span>
        </div>
      </div>
      <div className="chart">
        {daily.map((d) => {
          const total = d.violation + d.emergency
          return (
            <div key={d.date} className="chart__col" title={`${d.date}: ${d.violation} / ${d.emergency}`}>
              <span className="chart__num">{total || ''}</span>
              <div className="chart__bar" style={{ height: `${(total / max) * 100}%` }}>
                {d.emergency > 0 && <div className="chart__seg chart__seg--e" style={{ flex: d.emergency }} />}
                {d.violation > 0 && <div className="chart__seg chart__seg--v" style={{ flex: d.violation }} />}
              </div>
              <span className="chart__label">
                {new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short' })}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Overview({ stats: allStats, t, onOpen }) {
  const [tgState, setTgState] = useState(null)
  const [filter, setFilter] = useState('')
  const [filtered] = usePolling(() => (filter ? api.stats(filter) : Promise.resolve(null)), 4000, filter)
  const [recent] = usePolling(() => api.events('', 6, filter).catch(() => []), 5000, filter)
  const stats = filter && filtered ? filtered : allStats

  const testTelegram = async () => {
    setTgState('sending')
    try {
      await api.telegramTest()
      setTgState('ok')
    } catch (e) {
      setTgState(e.message)
    }
  }

  if (!stats) return <p className="note">{t.loading}</p>
  const types = Object.entries(allStats?.by_type || {}).sort((a, b) => b[1] - a[1])
  const chipTypes = [...VIOLATION_TYPES, ...EMERGENCY_TYPES].filter(
    (k) => k === 'sos' || (stats.enabled_detections || []).includes(k) || allStats?.by_type?.[k],
  )

  return (
    <div className="overview">
      <TypeChips types={chipTypes} value={filter} onChange={setFilter} t={t} />
      <div className="stats">
        <StatTile label={t.statCameras} value={`${stats.cameras_online}/${stats.cameras_total}`} />
        <StatTile label={t.statViolationsToday} value={stats.violations_today} tone={stats.violations_today ? 'warn' : ''} />
        <StatTile label={t.statEmergenciesToday} value={stats.emergencies_today} tone={stats.emergencies_today ? 'danger' : ''} />
        <StatTile label={t.statOpen} value={stats.open_violations + stats.open_emergencies} />
      </div>

      <div className="overview__grid">
        <WeekChart daily={stats.daily} t={t} />

        <div className="card-box">
          <div className="card-box__head"><h3>{t.byType}</h3></div>
          {types.length === 0 ? (
            <p className="note">{t.noDataYet}</p>
          ) : (
            <ul className="types">
              {types.map(([type, n]) => (
                <li key={type}>
                  <button type="button" className={`types__btn${filter === type ? ' types__btn--on' : ''}`} onClick={() => setFilter(filter === type ? '' : type)}>
                    <span>{typeLabel(t, type)}</span><b>{n}</b>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-box">
          <div className="card-box__head"><h3>{t.systemStatus}</h3></div>
          <ul className="sys">
            <li>
              <span>{t.aiDetection}</span>
              <span className={`pill pill--${stats.detector.ready ? 'ok' : stats.detector.error ? 'bad' : 'wait'}`}>
                {stats.detector.ready ? t.statusReady : stats.detector.error ? t.statusError : t.statusLoading}
              </span>
            </li>
            {stats.detector.error && <li className="sys__err">{stats.detector.error}</li>}
            <li>
              <span>Telegram</span>
              <span className={`pill pill--${stats.telegram ? 'ok' : 'off'}`}>
                {stats.telegram ? t.statusConnected : t.statusNotConfigured}
              </span>
            </li>
          </ul>
          {stats.telegram && (
            <button type="button" className="btn-sm" onClick={testTelegram} disabled={tgState === 'sending'}>
              {t.sendTest}
            </button>
          )}
          {tgState && tgState !== 'sending' && (
            <p className={`note ${tgState === 'ok' ? 'note--ok' : 'note--error'}`}>
              {tgState === 'ok' ? t.testSent : tgState}
            </p>
          )}
          {!stats.telegram && (
            <>
              <p className="note">{t.telegramHint}</p>
              <button type="button" className="btn-sm" onClick={() => onOpen('settings')}>{t.openSettings}</button>
            </>
          )}
        </div>

        <div className="card-box">
          <div className="card-box__head"><h3>{t.recentEvents}</h3></div>
          {!recent || recent.length === 0 ? (
            <p className="note">{t.noDataYet}</p>
          ) : (
            <ul className="recent">
              {recent.map((ev) => (
                <li key={ev.id}>
                  <button type="button" onClick={() => onOpen(ev.category === 'emergency' ? 'emergency' : 'violations')}>
                    <i className={`dot dot--${ev.category}`} />
                    <span className="recent__type">{typeLabel(t, ev.type)}</span>
                    <span className="recent__meta">{[ev.camera_name, ev.location, formatTime(ev.created_at)].filter(Boolean).join(' · ')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
