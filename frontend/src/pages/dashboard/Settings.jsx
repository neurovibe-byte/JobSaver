import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { CheckIcon, TrashIcon } from '../../components/icons.jsx'

function Section({ title, subtitle, children }) {
  return (
    <section className="set-section">
      <header>
        <h3>{title}</h3>
        {subtitle && <p className="note">{subtitle}</p>}
      </header>
      {children}
    </section>
  )
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`toggle${checked ? ' toggle--on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  )
}

const errText = (t, e) => (e?.status === 0 ? t.errorNetwork : e?.message || t.errorGeneric)

export default function Settings({ t, onSaved }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [org, setOrg] = useState('')
  const [orgSaved, setOrgSaved] = useState(false)

  const load = () =>
    api
      .settings()
      .then((d) => {
        setData(d)
        setOrg(d.organization)
      })
      .catch((e) => setError(errText(t, e)))

  useEffect(() => {
    load()
    // poll while an optional model is downloading so its state updates
    const id = setInterval(() => {
      api.settings().then((d) => setData((cur) => (cur ? { ...d, organization: cur.organization } : d))).catch(() => {})
    }, 4000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, [])

  if (!data) return <p className="note">{error || t.loading}</p>

  const setDetection = async (key, on) => {
    setData((d) => ({ ...d, detections: d.detections.map((x) => (x.key === key ? { ...x, enabled: on } : x)) }))
    try {
      setData(await api.saveSettings({ detections: { [key]: on } }))
      onSaved?.()
    } catch (e) {
      setError(errText(t, e))
      load()
    }
  }

  const saveOrg = async () => {
    setData(await api.saveSettings({ organization: org }))
    setOrgSaved(true)
    setTimeout(() => setOrgSaved(false), 2000)
  }

  return (
    <div className="settings">
      {error && <p className="note note--error">{error}</p>}

      <Section title={t.setDetections} subtitle={t.setDetectionsSub}>
        <ul className="det-list">
          {data.detections.map((d) => (
            <li key={d.key} className="det">
              <div className="det__text">
                <span className="det__title">
                  {t.types[d.key]}
                  <em className={`tag tag--${d.category}`}>{d.category === 'emergency' ? t.emergencies : t.tabViolations}</em>
                  {d.optional && <em className="tag">{t.optionalModel}</em>}
                </span>
                <span className="note">{t.detDesc[d.key]}</span>
                {d.optional && d.enabled && d.model_state !== 'ready' && (
                  <span className={`note ${d.model_state.startsWith('error') ? 'note--error' : ''}`}>
                    {d.model_state === 'loading' ? t.modelLoading : d.model_state}
                  </span>
                )}
              </div>
              <Toggle checked={d.enabled} onChange={(on) => setDetection(d.key, on)} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t.setOrg} subtitle={t.setOrgSub}>
        <div className="inline-form">
          <input value={org} onChange={(e) => setOrg(e.target.value)} placeholder={t.setOrgPlaceholder} maxLength={200} />
          <button type="button" className="btn-sm" onClick={saveOrg}>{orgSaved ? <><CheckIcon /> {t.saved}</> : t.save}</button>
        </div>
      </Section>

      <TelegramSettings t={t} tg={data.telegram} onChange={(tg) => setData((d) => ({ ...d, telegram: tg }))} />
    </div>
  )
}

function TelegramSettings({ t, tg, onChange }) {
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null) // { ok, text }
  const [found, setFound] = useState(null)
  const [manualId, setManualId] = useState('')

  const run = async (key, fn, okText) => {
    setBusy(key)
    setMsg(null)
    try {
      const res = await fn()
      if (res && 'connected' in res) onChange(res)
      if (okText) setMsg({ ok: true, text: typeof okText === 'function' ? okText(res) : okText })
      return res
    } catch (e) {
      setMsg({ ok: false, text: errText(t, e) })
    } finally {
      setBusy('')
    }
  }

  const discover = async () => {
    const res = await run('discover', api.telegramDiscover)
    if (res) setFound(res)
  }

  const toggleType = (type, on) => {
    const next = on ? [...new Set([...tg.notify_types, type])] : tg.notify_types.filter((x) => x !== type)
    run('prefs', () => api.telegramPrefs({ notify_types: next }))
  }

  const botName = tg.bot?.username ? `@${tg.bot.username}` : t.tgYourBot

  return (
    <Section title="Telegram" subtitle={t.tgSub}>
      <div className={`tg-state ${tg.active ? 'tg-state--ok' : ''}`}>
        <span className="tg-state__dot" />
        {tg.active ? t.tgActive(botName, tg.chats.length) : !tg.connected ? t.tgStep1Needed : !tg.chats.length ? t.tgStep2Needed : t.tgPaused}
      </div>

      {/* Step 1: bot token */}
      <div className="step">
        <span className="step__n">1</span>
        <div className="step__body">
          <h4>{t.tgStep1}</h4>
          {tg.connected ? (
            <div className="inline-form">
              <span className="pill pill--ok">{t.tgConnectedTo(botName)}</span>
              <span className="note">{t.tgToken} {tg.token_hint}</span>
              <button type="button" className="btn-sm btn-sm--ghost" disabled={!!busy}
                onClick={() => window.confirm(t.tgDisconnectConfirm) && run('disc', api.telegramDisconnect)}>
                {t.tgDisconnect}
              </button>
            </div>
          ) : (
            <>
              <ol className="howto">
                <li>{t.tgHow1}</li>
                <li>{t.tgHow2}</li>
                <li>{t.tgHow3}</li>
              </ol>
              <form className="inline-form" onSubmit={(e) => { e.preventDefault(); run('connect', () => api.telegramConnect(token.trim())).then((r) => r && setToken('')) }}>
                <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456789:AAH…" autoComplete="off" spellCheck={false} />
                <button type="submit" className="btn-sm" disabled={busy === 'connect' || token.trim().length < 20}>
                  {busy === 'connect' ? t.loading : t.tgConnect}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Step 2: recipients */}
      <div className={`step${tg.connected ? '' : ' step--off'}`}>
        <span className="step__n">2</span>
        <div className="step__body">
          <h4>{t.tgStep2}</h4>
          <p className="note">{t.tgStep2Help(botName)}</p>
          <div className="inline-form">
            <button type="button" className="btn-sm" disabled={!tg.connected || busy === 'discover'} onClick={discover}>
              {busy === 'discover' ? t.loading : t.tgFindChats}
            </button>
          </div>
          {found && (
            found.length === 0 ? <p className="note">{t.tgNoChatsFound}</p> : (
              <ul className="chat-list">
                {found.map((c) => (
                  <li key={c.id}>
                    <span>{c.name} <em className="note">({c.type}, {c.id})</em></span>
                    {c.added || tg.chats.some((x) => String(x.id) === c.id) ? (
                      <span className="pill pill--ok">{t.tgAdded}</span>
                    ) : (
                      <button type="button" className="btn-sm" onClick={() => run('add', () => api.telegramAddChat(c.id, c.name))}>{t.tgAdd}</button>
                    )}
                  </li>
                ))}
              </ul>
            )
          )}
          <h5>{t.tgRecipients}</h5>
          {tg.chats.length === 0 ? <p className="note">{t.tgNoRecipients}</p> : (
            <ul className="chat-list">
              {tg.chats.map((c) => (
                <li key={c.id}>
                  <span>{c.name || t.tgChat} <em className="note">({c.id})</em></span>
                  <button type="button" className="icon-btn" title={t.delete} onClick={() => run('rm', () => api.telegramRemoveChat(c.id))}><TrashIcon /></button>
                </li>
              ))}
            </ul>
          )}
          <form className="inline-form" onSubmit={(e) => { e.preventDefault(); manualId.trim() && run('add', () => api.telegramAddChat(manualId.trim(), '')).then(() => setManualId('')) }}>
            <input value={manualId} onChange={(e) => setManualId(e.target.value)} placeholder={t.tgManualId} />
            <button type="submit" className="btn-sm btn-sm--ghost" disabled={!tg.connected}>{t.tgAdd}</button>
          </form>
        </div>
      </div>

      {/* Step 3: what to send */}
      <div className={`step${tg.connected && tg.chats.length ? '' : ' step--off'}`}>
        <span className="step__n">3</span>
        <div className="step__body">
          <h4>{t.tgStep3}</h4>
          <div className="inline-form">
            <span>{t.tgSendAlerts}</span>
            <Toggle checked={tg.enabled} onChange={(on) => run('prefs', () => api.telegramPrefs({ enabled: on }))} />
          </div>
          <div className="checks">
            {Object.keys(t.types).filter((k) => !['no_mask', 'no_goggles', 'no_glove', 'no_shoes'].includes(k)).map((k) => (
              <label key={k} className="check">
                <input type="checkbox" checked={tg.notify_types.includes(k)} onChange={(e) => toggleType(k, e.target.checked)} />
                {t.types[k]}
              </label>
            ))}
          </div>
          <p className="note">{t.tgMessageInfo}</p>
          <button type="button" className="btn-sm" disabled={!tg.connected || !tg.chats.length || busy === 'test'}
            onClick={() => run('test', api.telegramTest, (r) => t.tgTestSent(r.sent, r.total))}>
            {busy === 'test' ? t.loading : t.sendTest}
          </button>
        </div>
      </div>

      {msg && <p className={`note ${msg.ok ? 'note--ok' : 'note--error'}`}>{msg.text}</p>}
    </Section>
  )
}
