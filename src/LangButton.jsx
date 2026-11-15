import { STRINGS } from './translations.js'

function GlobeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

export default function LangButton({ lang, onToggle }) {
  return (
    <button
      type="button"
      className="topbar__btn"
      onClick={onToggle}
      aria-label="Switch language"
    >
      <GlobeIcon />
      <span key={lang} className="topbar__lang-label">
        {STRINGS[lang].langLabel}
      </span>
    </button>
  )
}
