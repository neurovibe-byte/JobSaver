import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { LogoMark } from '../../components/Logo.jsx'
import {
  AlertIcon,
  CameraIcon,
  GearIcon,
  GridIcon,
  LogoutIcon,
  PhoneIcon,
  PhoneOffIcon,
  ShieldIcon,
} from '../../components/icons.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useBroadcaster } from '../../hooks/useBroadcaster.js'
import { usePolling } from '../../hooks/usePolling.js'
import { api } from '../../lib/api.js'
import { t } from '../../lib/strings.js'
import Cameras from './Cameras.jsx'
import Journal from './Journal.jsx'
import Overview from './Overview.jsx'
import Settings from './Settings.jsx'
import './dashboard.css'

const TAB_IDS = ['overview', 'cameras', 'violations', 'emergency', 'settings']

export default function DashboardPage() {
  const { tab: tabParam } = useParams()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const email = user?.email
  const active = TAB_IDS.includes(tabParam) ? tabParam : 'overview'
  const setActive = (id) => navigate(`/app/${id}`)
  const [stats, , reloadStats] = usePolling(api.stats, 4000)
  const bc = useBroadcaster()

  const openV = stats?.open_violations || 0
  const openE = stats?.open_emergencies || 0
  const tabs = [
    { id: 'overview', label: t.tabOverview, Icon: GridIcon, desc: t.descOverview },
    { id: 'cameras', label: t.tabCameras, Icon: CameraIcon, desc: t.descCameras },
    { id: 'violations', label: t.tabViolations, Icon: AlertIcon, desc: t.descViolations, count: openV },
    { id: 'emergency', label: t.tabEmergency, Icon: PhoneIcon, desc: t.descEmergency, count: openE, danger: true },
    { id: 'settings', label: t.tabSettings, Icon: GearIcon, desc: t.descSettings },
  ]
  const tab = tabs.find((x) => x.id === active)
  if (tabParam && !TAB_IDS.includes(tabParam)) return <Navigate to="/app" replace />
  const initial = (email || 'U').trim().charAt(0).toUpperCase() || 'U'

  const raiseSos = async () => {
    const note = window.prompt(t.sosPrompt, '')
    if (note === null) return
    await api.sos(null, note).catch(() => {})
    reloadStats()
  }

  return (
    <div className="dash">
      <header className="dash__topbar">
        {bc.camId && (
          <div className="bcbar">
            <span className="bcbar__dot" />
            {t.broadcasting}
            {active !== 'cameras' && (
              <button type="button" className="bcbar__link" onClick={() => setActive('cameras')}>{t.tabCameras}</button>
            )}
            <button type="button" className="bcbar__stop" onClick={bc.stop}>{t.stopBroadcast}</button>
          </div>
        )}
        <button type="button" className="topbar__btn topbar__btn--danger" onClick={() => { bc.stop(); logout(); navigate('/') }}>
          <LogoutIcon />
          {t.logout}
        </button>
      </header>

      <div className="dash__row">
        <aside className="dash__sidebar">
          <Link to="/" className="dash__brand">
            <LogoMark size="sm" />
            <span className="dash__brand-name">JobSaver</span>
          </Link>

          <nav className="dash__nav" aria-label={t.panelNav}>
            {tabs.map(({ id, label, Icon, count, danger }) => (
              <button
                key={id}
                type="button"
                className={`nav-item${active === id ? ' nav-item--active' : ''}`}
                onClick={() => setActive(id)}
                aria-current={active === id ? 'page' : undefined}
              >
                <Icon />
                <span>{label}</span>
                {count > 0 && <b className={`nav-item__count${danger ? ' nav-item__count--danger' : ''}`}>{count}</b>}
              </button>
            ))}
          </nav>

          <div className="dash__user">
            <div className="dash__avatar" aria-hidden="true">{initial}</div>
            <div className="dash__user-info">
              <span className="dash__user-email" title={email}>{email || t.guest}</span>
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
              {openE > 0 ? (
                <button type="button" className="dash__badge dash__badge--danger" onClick={() => setActive('emergency')}>
                  {t.activeEmergencies(openE)}
                </button>
              ) : (
                <span className="dash__badge">{t.systemOk}</span>
              )}
            </header>

            <div className="dash__content">
              {active === 'overview' ? (
                <Overview stats={stats} t={t} onOpen={setActive} />
              ) : active === 'cameras' ? (
                <Cameras t={t} bc={bc} />
              ) : active === 'settings' ? (
                <Settings t={t} onSaved={reloadStats} />
              ) : active === 'violations' ? (
                <Journal
                  category="violation"
                  icon={<AlertIcon />}
                  title={t.journalViolations}
                  subtitle={t.journalViolationsSub}
                  emptyIcon={<ShieldIcon />}
                  emptyTitle={t.journalViolationsEmpty}
                  emptyText={t.journalViolationsEmptyText}
                  t={t}
                  onChanged={reloadStats}
                />
              ) : (
                <Journal
                  category="emergency"
                  icon={<PhoneIcon />}
                  title={t.journalEmergency}
                  subtitle={t.journalEmergencySub}
                  emptyIcon={<PhoneOffIcon />}
                  emptyTitle={t.journalEmergencyEmpty}
                  emptyText={t.journalEmergencyEmptyText}
                  t={t}
                  onChanged={reloadStats}
                  extra={<button type="button" className="btn-sm btn-sm--danger journal__sos" onClick={raiseSos}>SOS</button>}
                />
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
