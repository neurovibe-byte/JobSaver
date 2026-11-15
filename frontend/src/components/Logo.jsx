/** The JobSaver mark (white bookmark on the green rounded square). */
export function LogoMark({ size = 'md' }) {
  const px = { sm: 18, md: 20, lg: 24 }[size] || 20
  return (
    <div className={`brand__mark${size === 'sm' ? ' brand__mark--sm' : ''}`} aria-hidden="true">
      <svg width={px} height={px} viewBox="0 0 24 24" fill="#fff">
        <path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-3.8-6.5 3.8v-16a1 1 0 0 1 1-1Z" />
      </svg>
    </div>
  )
}

export default function Logo({ size = 'sm', className = '' }) {
  return (
    <span className={`logo ${className}`}>
      <LogoMark size={size} />
      <span className="logo__name">JobSaver</span>
    </span>
  )
}
