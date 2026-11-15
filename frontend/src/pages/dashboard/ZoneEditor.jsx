import { useEffect, useRef, useState } from 'react'
import { api, mediaUrl } from '../../lib/api.js'

/** Click on the camera picture to draw the danger-zone polygon (coordinates saved as 0..1). */
export default function ZoneEditor({ cam, t, onClose, onSaved }) {
  const [points, setPoints] = useState(cam.zone || [])
  const [frameUrl, setFrameUrl] = useState(mediaUrl(`/api/cameras/${cam.id}/snapshot.jpg`, Date.now()))
  const [noFrame, setNoFrame] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const imgRef = useRef(null)

  // refresh the background frame every 2 s so it isn't stale
  useEffect(() => {
    const id = setInterval(() => setFrameUrl(mediaUrl(`/api/cameras/${cam.id}/snapshot.jpg`, Date.now())), 2000)
    return () => clearInterval(id)
  }, [cam.id])

  const addPoint = (e) => {
    const r = imgRef.current.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    setPoints((p) => [...p, [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]])
  }

  const save = async (pts) => {
    setBusy(true)
    setError('')
    try {
      await api.updateCamera(cam.id, { zone: pts })
      onSaved()
      onClose()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const poly = points.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')

  return (
    <div className="lightbox" role="dialog" onClick={onClose}>
      <figure className="zone" onClick={(e) => e.stopPropagation()}>
        <div className="zone__canvas">
          <img
            ref={imgRef}
            src={frameUrl}
            alt=""
            onLoad={() => setNoFrame(false)}
            onError={() => setNoFrame(true)}
            draggable={false}
          />
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" onClick={addPoint}>
            {points.length >= 3 && <polygon points={poly} className="zone__poly" />}
            {points.length > 0 && points.length < 3 && <polyline points={poly} className="zone__line" />}
            {points.map(([x, y], i) => (
              <circle key={i} cx={x * 100} cy={y * 100} r="1.1" className="zone__pt" />
            ))}
          </svg>
          {noFrame && <p className="zone__noframe">{t.zoneNoFrame}</p>}
        </div>
        <figcaption className="zone__bar">
          <span className="note">{points.length < 3 ? t.zoneHelp : t.zonePoints(points.length)}</span>
          {error && <span className="note note--error">{error}</span>}
          <div className="zone__actions">
            <button type="button" className="btn-sm btn-sm--ghost" disabled={!points.length} onClick={() => setPoints((p) => p.slice(0, -1))}>{t.zoneUndo}</button>
            <button type="button" className="btn-sm btn-sm--ghost" disabled={!points.length} onClick={() => setPoints([])}>{t.zoneClear}</button>
            {cam.zone && <button type="button" className="btn-sm btn-sm--danger" disabled={busy} onClick={() => save([])}>{t.zoneRemove}</button>}
            <button type="button" className="btn-sm btn-sm--ghost" onClick={onClose}>{t.cancel}</button>
            <button type="button" className="btn-sm" disabled={busy || points.length < 3} onClick={() => save(points)}>{t.save}</button>
          </div>
        </figcaption>
      </figure>
    </div>
  )
}
