import { useCallback, useEffect, useRef, useState } from 'react'
import { getToken } from '../lib/api.js'

const SEND_INTERVAL_MS = 125 // at most ~8 frames/s to the server
const MAX_WIDTH = 1280
const JPEG_QUALITY = 0.7

function wsUrl(path) {
  const base = import.meta.env.VITE_API_URL
  const origin = base ? new URL(base) : window.location
  const proto = origin.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${origin.host}${path}?token=${encodeURIComponent(getToken() || '')}`
}

export const cameraSupported = () => !!navigator.mediaDevices?.getUserMedia
export const needsHttps = () => !window.isSecureContext

/**
 * Streams this device's camera (laptop webcam / phone front or back) to a "browser" camera
 * on the backend, which runs detection on it like any other camera.
 * Lives at dashboard level so broadcasting continues while switching tabs.
 */
export function useBroadcaster() {
  const [state, setState] = useState({ camId: null, facing: 'environment', status: 'idle', error: null })
  const [stream, setStream] = useState(null)
  const r = useRef({ active: false, ws: null, video: null, canvas: null, timer: null, retry: null, waiting: false })

  const stopTracks = () => {
    const v = r.current.video
    v?.srcObject?.getTracks().forEach((t) => t.stop())
    if (v) v.srcObject = null
  }

  const openCamera = async (facing) => {
    stopTracks()
    const media = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
    })
    if (!r.current.video) {
      const v = document.createElement('video')
      v.muted = true
      v.playsInline = true
      v.setAttribute('playsinline', '')
      r.current.video = v
    }
    r.current.video.srcObject = media
    await r.current.video.play().catch(() => {})
    setStream(media)
  }

  const sendFrame = () => {
    const { ws, video, active, waiting } = r.current
    if (!active || waiting || !ws || ws.readyState !== WebSocket.OPEN) return
    if (!video || video.readyState < 2 || !video.videoWidth) return
    const scale = Math.min(1, MAX_WIDTH / video.videoWidth)
    const c = (r.current.canvas ||= document.createElement('canvas'))
    c.width = Math.round(video.videoWidth * scale)
    c.height = Math.round(video.videoHeight * scale)
    c.getContext('2d').drawImage(video, 0, 0, c.width, c.height)
    r.current.waiting = true
    c.toBlob(
      (blob) => {
        if (blob && r.current.ws === ws && ws.readyState === WebSocket.OPEN) ws.send(blob)
        else r.current.waiting = false
      },
      'image/jpeg',
      JPEG_QUALITY,
    )
  }

  const connect = (camId) => {
    const ws = new WebSocket(wsUrl(`/api/cameras/${camId}/publish`))
    r.current.ws = ws
    r.current.waiting = false
    ws.onopen = () => setState((s) => ({ ...s, status: 'live', error: null }))
    ws.onmessage = () => {
      r.current.waiting = false // server processed the last frame
    }
    ws.onclose = (e) => {
      if (r.current.ws !== ws || !r.current.active) return
      if (e.code === 4409) {
        // another device took over this camera (or it was paused/deleted)
        teardown()
        setState((s) => ({ ...s, camId: null, status: 'idle', error: 'taken' }))
        return
      }
      if (e.code === 4401) {
        teardown()
        setState((s) => ({ ...s, camId: null, status: 'idle', error: 'auth' }))
        return
      }
      setState((s) => ({ ...s, status: 'reconnecting' }))
      r.current.retry = setTimeout(() => r.current.active && connect(camId), 2000)
    }
  }

  const teardown = () => {
    r.current.active = false
    clearInterval(r.current.timer)
    clearTimeout(r.current.retry)
    const ws = r.current.ws
    r.current.ws = null
    if (ws && ws.readyState <= WebSocket.OPEN) ws.close()
    stopTracks()
    setStream(null)
  }

  const start = useCallback(async (camId, facing = 'environment') => {
    teardown()
    if (needsHttps()) return setState({ camId: null, facing, status: 'idle', error: 'https' })
    if (!cameraSupported()) return setState({ camId: null, facing, status: 'idle', error: 'unsupported' })
    setState({ camId, facing, status: 'starting', error: null })
    try {
      await openCamera(facing)
    } catch (e) {
      stopTracks()
      return setState({ camId: null, facing, status: 'idle', error: e?.name === 'NotAllowedError' ? 'denied' : 'nocamera' })
    }
    r.current.active = true
    connect(camId)
    r.current.timer = setInterval(sendFrame, SEND_INTERVAL_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- helpers only touch refs and state setters
  }, [])

  const stop = useCallback(() => {
    teardown()
    setState((s) => ({ ...s, camId: null, status: 'idle', error: null }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- teardown only touches refs and setters
  }, [])

  const flip = useCallback(async () => {
    const facing = state.facing === 'user' ? 'environment' : 'user'
    setState((s) => ({ ...s, facing }))
    try {
      await openCamera(facing)
    } catch {
      setState((s) => ({ ...s, error: 'nocamera' }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openCamera only touches refs and setters
  }, [state.facing])

  // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup on unmount only
  useEffect(() => () => teardown(), [])

  return { ...state, stream, start, stop, flip }
}
