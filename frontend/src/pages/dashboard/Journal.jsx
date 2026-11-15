import { useState } from 'react'
import { api, mediaUrl } from '../../lib/api.js'
import { usePolling } from '../../hooks/usePolling.js'
import { typeLabel, formatTime } from '../../lib/format.js'
import { VIOLATION_TYPES, EMERGENCY_TYPES, TypeChips, ErrorNote } from './common.jsx'
import { CheckIcon } from '../../components/icons.jsx'

export default function Journal({ category, icon, title, subtitle, emptyIcon, emptyTitle, emptyText, t, onChanged, extra }) {
  const [type, setType] = useState('')
  const [events, error, reload] = usePolling(() => api.events(category, 100, type), 4000, type)
  const [preview, setPreview] = useState(null)

  const ack = async (id) => {
    await api.ack(id).catch(() => {})
    reload()
    onChanged()
  }

  return (
    <div className="journal">
      <div className="journal__head">
        <div className="journal__head-icon" aria-hidden="true">{icon}</div>
        <div className="journal__head-text">
          <h3 className="journal__title">{title}</h3>
          <p className="journal__subtitle">{subtitle}</p>
        </div>
        {extra}
      </div>
      <div className="journal__filters">
        <TypeChips types={category === 'emergency' ? EMERGENCY_TYPES : VIOLATION_TYPES} value={type} onChange={setType} t={t} />
      </div>
      <ErrorNote error={error} t={t} />
      {!events || events.length === 0 ? (
        <div className="journal__body">
          <div className="journal__empty">
            <div className="journal__empty-icon" aria-hidden="true">{emptyIcon}</div>
            <p className="journal__empty-title">{emptyTitle}</p>
            <p className="journal__empty-text">{emptyText}</p>
          </div>
        </div>
      ) : (
        <ul className="events">
          {events.map((ev) => (
            <li key={ev.id} className={`event${ev.acknowledged ? ' event--done' : ''} event--${category}`}>
              {ev.snapshot ? (
                <button type="button" className="event__thumb" onClick={() => setPreview(ev)}>
                  <img src={mediaUrl(`/api/events/${ev.id}/snapshot.jpg`)} alt="" loading="lazy" />
                </button>
              ) : (
                <div className="event__thumb event__thumb--none">{icon}</div>
              )}
              <div className="event__body">
                <span className="event__type">{typeLabel(t, ev.type)}</span>
                <span className="event__meta">
                  {ev.camera_name || '—'}{ev.location && ` · 📍 ${ev.location}`} · {formatTime(ev.created_at)}
                  {ev.persons > 0 && ` · ${t.persons(ev.persons)}`}
                  {ev.confidence > 0 && ` · ${Math.round(ev.confidence * 100)}%`}
                  {ev.notified && ' · Telegram ✓'}
                </span>
                {ev.note && <span className="event__note">{ev.note}</span>}
              </div>
              {ev.acknowledged ? (
                <span className="event__done"><CheckIcon /> {t.acknowledged}</span>
              ) : (
                <button type="button" className="btn-sm" onClick={() => ack(ev.id)}>{t.acknowledge}</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {preview && (
        <div className="lightbox" role="dialog" onClick={() => setPreview(null)}>
          <figure onClick={(e) => e.stopPropagation()}>
            <img src={mediaUrl(`/api/events/${preview.id}/snapshot.jpg`)} alt="" />
            <figcaption>
              {typeLabel(t, preview.type)} · {preview.camera_name} · {formatTime(preview.created_at)}
              <button type="button" className="btn-sm btn-sm--ghost" onClick={() => setPreview(null)}>{t.close}</button>
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  )
}
