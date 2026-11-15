/**
 * Illustrated "live camera" for the hero: workers, a danger zone and animated AI detections.
 * Pure SVG + CSS animation, no video or images needed.
 */
function Worker({ x, helmet, vest = '#e8954a', walk }) {
  return (
    // outer <g> positions the worker; the inner one animates (CSS transform would override the SVG attribute)
    <g transform={`translate(${x} 0)`}>
      <g className={walk ? 'demo-walk' : undefined}>
      {/* legs */}
      <rect x="-13" y="262" width="11" height="70" rx="5" fill="#2b3a33" />
      <rect x="2" y="262" width="11" height="70" rx="5" fill="#2b3a33" />
      <rect x="-16" y="326" width="15" height="8" rx="3" fill="#1b2420" />
      <rect x="1" y="326" width="15" height="8" rx="3" fill="#1b2420" />
      {/* body + vest */}
      <rect x="-22" y="182" width="44" height="88" rx="16" fill="#3c4f6b" />
      <path d="M-20 196 h40 v58 a10 10 0 0 1 -10 10 h-20 a10 10 0 0 1 -10 -10z" fill={vest} opacity="0.95" />
      <rect x="-20" y="222" width="40" height="5" fill="#f6f3d0" opacity="0.9" />
      <rect x="-20" y="240" width="40" height="5" fill="#f6f3d0" opacity="0.9" />
      {/* arms */}
      <rect x="-31" y="190" width="11" height="62" rx="5.5" fill="#3c4f6b" />
      <rect x="20" y="190" width="11" height="62" rx="5.5" fill="#3c4f6b" />
      {/* head */}
      <circle cx="0" cy="160" r="19" fill="#d9a77e" />
      {helmet ? (
        <>
          <path d="M-23 158 a23 23 0 0 1 46 0 z" fill="#f5c542" />
          <rect x="-26" y="155" width="52" height="6" rx="3" fill="#e0ad22" />
        </>
      ) : (
        <path d="M-19 156 a19 19 0 0 1 38 0 q-6 -9 -19 -9 q-13 0 -19 9z" fill="#3a2a20" />
      )}
      </g>
    </g>
  )
}

export default function LiveDemo() {
  return (
    <div className="demo" aria-label="Illustration: AI detecting a missing helmet and a person in a danger zone">
      <div className="demo__screen">
        <svg viewBox="0 0 640 400" className="demo__svg" role="img" aria-hidden="true">
          <defs>
            <linearGradient id="demo-floor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1f3029" />
              <stop offset="1" stopColor="#13201b" />
            </linearGradient>
            <pattern id="demo-stripes" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="7" height="14" fill="#f5c542" />
              <rect x="7" width="7" height="14" fill="#2b2b2b" />
            </pattern>
          </defs>

          {/* room */}
          <rect width="640" height="400" fill="#22332b" />
          <rect y="232" width="640" height="168" fill="url(#demo-floor)" />
          {[280, 320, 360].map((y) => (
            <line key={y} x1="0" x2="640" y1={y} y2={y} stroke="#2f463c" strokeWidth="1" />
          ))}
          {[-200, 0, 200, 400, 600, 800].map((x) => (
            <line key={x} x1={320 + (x - 320) * 0.35} y1="232" x2={x} y2="400" stroke="#2f463c" strokeWidth="1" />
          ))}
          {/* shelves in the back */}
          <rect x="24" y="70" width="150" height="150" rx="6" fill="#2a3d35" />
          {[100, 140, 180].map((y) => (
            <rect key={y} x="24" y={y} width="150" height="5" fill="#35504a" />
          ))}
          <rect x="40" y="112" width="34" height="26" rx="3" fill="#8a6a3e" />
          <rect x="84" y="150" width="44" height="28" rx="3" fill="#7a5c35" />

          {/* danger zone + machine */}
          <polygon className="demo-zone" points="420,250 640,238 640,400 380,400" />
          <text x="452" y="272" className="demo-zone__label">DANGER ZONE</text>
          <rect x="500" y="150" width="120" height="110" rx="8" fill="#3d4f48" />
          <rect x="500" y="244" width="120" height="16" fill="url(#demo-stripes)" />
          <circle cx="560" cy="196" r="22" fill="#2a3832" stroke="#5b7268" strokeWidth="4" />
          <circle cx="560" cy="196" r="6" fill="#cf6a5a" className="demo-blink" />

          {/* workers */}
          <Worker x={150} helmet />
          <Worker x={300} helmet={false} vest="#5aa16f" />
          <Worker x={430} helmet walk />

          {/* AI detections */}
          <g className="demo-box demo-box--ok">
            <rect x="118" y="128" width="64" height="58" rx="4" />
            <text x="120" y="122">HELMET 94%</text>
          </g>
          <g className="demo-box demo-box--bad demo-pulse">
            <rect x="268" y="128" width="64" height="58" rx="4" />
            <text x="270" y="122">NO HELMET 87%</text>
          </g>
          <g className="demo-walk">
            <g className="demo-box demo-box--bad">
              <rect x="394" y="132" width="72" height="208" rx="4" />
              <text x="396" y="356">IN DANGER ZONE</text>
            </g>
          </g>
        </svg>

        <span className="demo__scan" aria-hidden="true" />
        <div className="demo__hud demo__hud--top">
          <span className="demo__live">LIVE</span>
          <span>CAM 01 · Workshop 2</span>
        </div>
        <div className="demo__hud demo__hud--bottom">
          <span>3 people</span>
          <span className="demo__sep" />
          <span>Helmet check ✓</span>
          <span className="demo__sep" />
          <span>Zone check ✓</span>
          <span className="demo__sep" />
          <span>3 fps</span>
        </div>
      </div>

      {/* floating alert, as it arrives in Telegram */}
      <div className="demo__toast demo__toast--tg">
        <span className="demo__toast-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M21.5 4.5 2.9 11.6c-1.1.4-1.1 1.1-.2 1.4l4.8 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.7c.3-1.3-.5-1.9-1.5-1.7Z"/></svg>
        </span>
        <div>
          <b>⚠️ No helmet</b>
          <span>Workshop 2 · Building A · 14:32:07</span>
        </div>
      </div>
      <div className="demo__toast demo__toast--stat">
        <span className="demo__toast-num">3</span>
        <span>violations today<br /><em>1 needs review</em></span>
      </div>
    </div>
  )
}
