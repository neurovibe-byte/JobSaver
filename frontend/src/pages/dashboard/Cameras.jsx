import { useEffect, useRef, useState } from 'react'
import { api, mediaUrl } from '../../lib/api.js'
import { needsHttps } from '../../hooks/useBroadcaster.js'
import { usePolling } from '../../hooks/usePolling.js'
import { ErrorNote } from './common.jsx'
import { CameraOffIcon, PlayIcon, PauseIcon, TrashIcon, PlusIcon, ZoneIcon, EditIcon } from '../../components/icons.jsx'
import ZoneEditor from './ZoneEditor.jsx'

function LocalPreview({ stream, mirrored, className }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream || null
  }, [stream])
  return <video ref={ref} className={`${className}${mirrored ? ' is-mirrored' : ''}`} autoPlay muted playsInline />
}

function FacingPicker({ value, onChange, t }) {
  return (
    <div className="seg">
      <button type="button" className={value === 'environment' ? 'seg--on' : ''} onClick={() => onChange('environment')}>{t.camBack}</button>
      <button type="button" className={value === 'user' ? 'seg--on' : ''} onClick={() => onChange('user')}>{t.camFront}</button>
    </div>
  )
}

function broadcastError(t, code) {
  return code ? t.bcErrors[code] || code : ''
}

function AddCameraForm({ t, onAdded, onCancel }) {
  const [mode, setMode] = useState('device') // 'device' | 'url' | 'file'
  const [facing, setFacing] = useState('environment')
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [source, setSource] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return setError(t.errorName)
    if (mode === 'url' && !source.trim()) return setError(t.errorSource)
    if (mode === 'file' && !file) return setError(t.errorFile)
    setBusy(true)
    setError('')
    try {
      let cam
      if (mode === 'device') cam = await api.addCamera(name.trim(), 'browser', location.trim())
      else if (mode === 'url') cam = await api.addCamera(name.trim(), source.trim(), location.trim())
      else cam = await api.uploadCamera(name.trim(), file, location.trim())
      onAdded(cam, mode === 'device' ? facing : null)
    } catch (err) {
      setError(err.status === 0 ? t.errorNetwork : err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="addcam" onSubmit={submit} noValidate>
      <div className="seg">
        <button type="button" className={mode === 'device' ? 'seg--on' : ''} onClick={() => setMode('device')}>{t.sourceDevice}</button>
        <button type="button" className={mode === 'url' ? 'seg--on' : ''} onClick={() => setMode('url')}>{t.sourceStream}</button>
        <button type="button" className={mode === 'file' ? 'seg--on' : ''} onClick={() => setMode('file')}>{t.sourceFile}</button>
      </div>
      <div className="addcam__row">
        <label>
          <span>{t.cameraNameLabel}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.cameraNamePlaceholder} />
        </label>
        <label>
          <span>{t.locationLabel}</span>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t.locationPlaceholder} />
        </label>
        {mode === 'device' ? (
          <div className="addcam__grow addcam__facing">
            <span>{t.whichCamera}</span>
            <FacingPicker value={facing} onChange={setFacing} t={t} />
          </div>
        ) : mode === 'url' ? (
          <label className="addcam__grow">
            <span>{t.sourceLabel}</span>
            <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="0  ·  rtsp://user:pass@192.168.1.10:554/stream  ·  http://192.168.1.5:8080/video" />
          </label>
        ) : (
          <label className="addcam__grow">
            <span>{t.videoFileLabel}</span>
            <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
        )}
      </div>
      <p className="note">{mode === 'device' ? t.deviceHint : mode === 'url' ? t.sourceHint : t.fileHint}</p>
      {mode === 'device' && needsHttps() && <p className="note note--error">{t.bcErrors.https}</p>}
      {error && <p className="note note--error">{error}</p>}
      <div className="addcam__actions">
        <button type="button" className="btn-sm btn-sm--ghost" onClick={onCancel}>{t.cancel}</button>
        <button type="submit" className="btn-sm" disabled={busy}>{busy ? t.loading : t.addCamera}</button>
      </div>
    </form>
  )
}

function CameraCard({ cam, t, onChanged, bc }) {
  const live = cam.enabled && cam.status === 'online'
  const statusText = !cam.enabled ? t.camPaused : t.camStatus[cam.status] || cam.status
  const isBrowser = cam.kind === 'browser'
  const mine = isBrowser && bc.camId === cam.id
  const [facing, setFacing] = useState('environment')
  const [zoneOpen, setZoneOpen] = useState(false)

  const edit = async () => {
    const name = window.prompt(t.cameraNameLabel, cam.name)
    if (name === null || !name.trim()) return
    const location = window.prompt(t.locationLabel, cam.location || '')
    if (location === null) return
    await api.updateCamera(cam.id, { name: name.trim(), location: location.trim() }).catch(() => {})
    onChanged()
  }

  const toggle = async () => {
    if (mine && cam.enabled) bc.stop()
    await api.updateCamera(cam.id, { enabled: !cam.enabled }).catch(() => {})
    onChanged()
  }
  const remove = async () => {
    if (!window.confirm(t.confirmDelete(cam.name))) return
    if (mine) bc.stop()
    await api.deleteCamera(cam.id).catch(() => {})
    onChanged()
  }
  const sos = async () => {
    const note = window.prompt(t.sosPrompt, '')
    if (note === null) return
    await api.sos(cam.id, note).catch(() => {})
    onChanged()
  }

  return (
    <div className="camera">
      <div className="camera__screen">
        {live ? (
          <img className="camera__video" src={mediaUrl(`/api/cameras/${cam.id}/stream`, cam.id)} alt={cam.name} />
        ) : (
          <>
            <span className="camera__corner camera__corner--tl" aria-hidden="true" />
            <span className="camera__corner camera__corner--tr" aria-hidden="true" />
            <span className="camera__corner camera__corner--bl" aria-hidden="true" />
            <span className="camera__corner camera__corner--br" aria-hidden="true" />
            <div className="camera__center">
              <div className="camera__icon" aria-hidden="true"><CameraOffIcon /></div>
              <p className="camera__label">{!cam.enabled ? t.camPaused : isBrowser ? t.waitingDevice : t.noSignal}</p>
              <p className="camera__hint">{isBrowser ? t.waitingDeviceHint : cam.error || cam.source}</p>
              {isBrowser && cam.enabled && !mine && (
                <div className="camera__start">
                  <FacingPicker value={facing} onChange={setFacing} t={t} />
                  <button type="button" className="btn-sm" onClick={() => bc.start(cam.id, facing)}>{t.startBroadcast}</button>
                </div>
              )}
            </div>
          </>
        )}
        {live && <span className="camera__live">LIVE</span>}
        {mine && bc.stream && <LocalPreview stream={bc.stream} mirrored={bc.facing === 'user'} className="camera__pip" />}
      </div>
      {mine && (
        <div className="camera__bc">
          <span>{t.bcStatus[bc.status] || bc.status}</span>
          <button type="button" className="btn-sm btn-sm--ghost" onClick={bc.flip}>{t.flipCamera}</button>
          <button type="button" className="btn-sm btn-sm--danger" onClick={bc.stop}>{t.stopBroadcast}</button>
        </div>
      )}
      <div className="camera__meta">
        <span className="camera__name">
          {cam.name}
          {isBrowser && <em className="camera__kind">{t.sourceDevice}</em>}
          {cam.zone && <em className="camera__kind camera__kind--zone">{t.zoneSet}</em>}
          {cam.location && <span className="camera__loc">📍 {cam.location}</span>}
        </span>
        <div className="camera__actions">
          <span className={`camera__status camera__status--${cam.enabled ? cam.status : 'stopped'}`}>
            <span className="camera__status-dot" aria-hidden="true" />
            {statusText}
            {live && cam.persons > 0 && ` · ${t.persons(cam.persons)}`}
          </span>
          <button type="button" className="icon-btn icon-btn--danger" title={t.sos} onClick={sos}>SOS</button>
          <button type="button" className="icon-btn" title={t.zoneEdit} onClick={() => setZoneOpen(true)}><ZoneIcon /></button>
          <button type="button" className="icon-btn" title={t.edit} onClick={edit}><EditIcon /></button>
          <button type="button" className="icon-btn" title={cam.enabled ? t.pause : t.resume} onClick={toggle}>
            {cam.enabled ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button type="button" className="icon-btn" title={t.delete} onClick={remove}><TrashIcon /></button>
        </div>
      </div>
      {zoneOpen && <ZoneEditor cam={cam} t={t} onClose={() => setZoneOpen(false)} onSaved={onChanged} />}
    </div>
  )
}

export default function Cameras({ t, bc }) {
  const [cams, error, reload] = usePolling(api.cameras, 4000)
  const [adding, setAdding] = useState(false)

  return (
    <div className="cams">
      <div className="toolbar">
        <ErrorNote error={error} t={t} />
        {bc.error && <p className="note note--error">{broadcastError(t, bc.error)}</p>}
        {!adding && (
          <button type="button" className="btn-sm" onClick={() => setAdding(true)}>
            <PlusIcon /> {t.addCamera}
          </button>
        )}
      </div>
      {adding && (
        <AddCameraForm
          t={t}
          onCancel={() => setAdding(false)}
          onAdded={(cam, facing) => {
            setAdding(false)
            if (facing && cam) bc.start(cam.id, facing)
            reload()
          }}
        />
      )}
      {cams && cams.length === 0 && !adding ? (
        <div className="camera">
          <div className="camera__screen">
            <div className="camera__center">
              <div className="camera__icon" aria-hidden="true"><CameraOffIcon /></div>
              <p className="camera__label">{t.noCameras}</p>
              <p className="camera__hint">{t.noCamerasHint}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="cams__grid">
          {(cams || []).map((c) => <CameraCard key={c.id} cam={c} t={t} onChanged={reload} bc={bc} />)}
        </div>
      )}
    </div>
  )
}
