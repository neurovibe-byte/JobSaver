import { useState } from 'react'
import LangButton from './LangButton.jsx'
import './dashboard.css'

function GridIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m22 8-6 4 6 4V8Z" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m10.29 3.86-8.18 14.14A2 2 0 0 0 3.84 21h16.32a2 2 0 0 0 1.73-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function CameraOffIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M10.66 6H14a2 2 0 0 1 2 2v2.5l5.248-3.062A.5.5 0 0 1 22 7.87v8.196" />
      <path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function PhoneOffIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
      <line x1="22" y1="2" x2="2" y2="22" />
    </svg>
  )
}

function CameraViewport({ t }) {
  return (
    <div className="camera">
      <div className="camera__screen">
        <span className="camera__corner camera__corner--tl" aria-hidden="true" />
        <span className="camera__corner camera__corner--tr" aria-hidden="true" />
        <span className="camera__corner camera__corner--bl" aria-hidden="true" />
        <span className="camera__corner camera__corner--br" aria-hidden="true" />
        <div className="camera__center">
          <div className="camera__icon" aria-hidden="true">
            <CameraOffIcon />
          </div>
          <p className="camera__label">{t.noSignal}</p>
          <p className="camera__hint">{t.cameraHint}</p>
        </div>
      </div>
      <div className="camera__meta">
        <span className="camera__name">{t.cameraName}</span>
        <span className="camera__status">
          <span className="camera__status-dot" aria-hidden="true" />
          {t.cameraStatus}
        </span>
      </div>
    </div>
  )
}

function Journal({ icon, title, subtitle, emptyIcon, emptyTitle, emptyText }) {
  return (
    <div className="journal">
      <div className="journal__head">
        <div className="journal__head-icon" aria-hidden="true">
          {icon}
        </div>
        <div className="journal__head-text">
          <h3 className="journal__title">{title}</h3>
          <p className="journal__subtitle">{subtitle}</p>
        </div>
      </div>
      <div className="journal__body">
        <div className="journal__empty">
          <div className="journal__empty-icon" aria-hidden="true">
            {emptyIcon}
          </div>
          <p className="journal__empty-title">{emptyTitle}</p>
          <p className="journal__empty-text">{emptyText}</p>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard({ email, t, lang, onToggleLang, onLogout }) {
  const [active, setActive] = useState('overview')

  const tabs = [
    { id: 'overview', label: t.tabOverview, Icon: GridIcon, desc: t.descOverview },
    { id: 'cameras', label: t.tabCameras, Icon: CameraIcon, desc: t.descCameras },
    { id: 'violations', label: t.tabViolations, Icon: AlertIcon, desc: t.descViolations },
    { id: 'emergency', label: t.tabEmergency, Icon: PhoneIcon, desc: t.descEmergency },
  ]
  const tab = tabs.find((x) => x.id === active)
  const initial = (email || 'U').trim().charAt(0).toUpperCase() || 'U'

  return (
    <div className="dash">
      <header className="dash__topbar">
        <LangButton lang={lang} onToggle={onToggleLang} />
        <button type="button" className="topbar__btn topbar__btn--danger" onClick={onLogout}>
          <LogoutIcon />
          {t.logout}
        </button>
      </header>

      <div className="dash__row">
        <aside className="dash__sidebar">
          <div className="dash__brand">
            <div className="brand__mark brand__mark--sm" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
                <path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-3.8-6.5 3.8v-16a1 1 0 0 1 1-1Z" />
              </svg>
            </div>
            <span className="dash__brand-name">JobSaver</span>
          </div>

          <nav className="dash__nav" aria-label={t.panelNav}>
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                className={`nav-item${active === id ? ' nav-item--active' : ''}`}
                onClick={() => setActive(id)}
                aria-current={active === id ? 'page' : undefined}
              >
                <Icon />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <div className="dash__user">
            <div className="dash__avatar" aria-hidden="true">
              {initial}
            </div>
            <div className="dash__user-info">
              <span className="dash__user-email" title={email}>
                {email || t.guest}
              </span>
            </div>
          </div>
        </aside>

        <main className="dash__main">
          <section key={active} className="dash__panel" aria-label={tab.label}>
            <header className="dash__header">
              <div>
                <h2 className="dash__title">{tab.label}</h2>
                <p className="dash__subtitle">{tab.desc}</p>
              </div>
              <span className="dash__badge">{t.systemOk}</span>
            </header>

            <div className="dash__content">
              {active === 'cameras' ? (
                <CameraViewport t={t} />
              ) : active === 'violations' ? (
                <Journal
                  icon={<AlertIcon />}
                  title={t.journalViolations}
                  subtitle={t.journalViolationsSub}
                  emptyIcon={<ShieldIcon />}
                  emptyTitle={t.journalViolationsEmpty}
                  emptyText={t.journalViolationsEmptyText}
                />
              ) : active === 'emergency' ? (
                <Journal
                  icon={<PhoneIcon />}
                  title={t.journalEmergency}
                  subtitle={t.journalEmergencySub}
                  emptyIcon={<PhoneOffIcon />}
                  emptyTitle={t.journalEmergencyEmpty}
                  emptyText={t.journalEmergencyEmptyText}
                />
              ) : (
                <div className="dash__empty">
                  <div className="dash__empty-icon">
                    <tab.Icon />
                  </div>
                  <h3 className="dash__empty-title">{t.emptyTitle(tab.label)}</h3>
                  <p className="dash__empty-text">{t.emptyText}</p>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
