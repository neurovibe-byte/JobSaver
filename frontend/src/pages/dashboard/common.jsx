/* Small pieces shared by the dashboard tabs. */
import { typeLabel } from '../../lib/format.js'

export const VIOLATION_TYPES = ['no_helmet', 'no_vest', 'restricted_zone']
export const EMERGENCY_TYPES = ['person_down', 'fire', 'sos']

export function TypeChips({ types, value, onChange, t }) {
  return (
    <div className="chips" role="tablist">
      <button type="button" className={`chip${!value ? ' chip--on' : ''}`} onClick={() => onChange('')}>{t.filterAll}</button>
      {types.map((k) => (
        <button key={k} type="button" className={`chip${value === k ? ' chip--on' : ''}`} onClick={() => onChange(k)}>
          {typeLabel(t, k)}
        </button>
      ))}
    </div>
  )
}

export function ErrorNote({ error, t }) {
  if (!error) return null
  return <p className="note note--error">{error.status === 0 ? t.errorNetwork : error.message}</p>
}
