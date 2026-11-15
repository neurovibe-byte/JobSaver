import { useEffect } from 'react'

/**
 * Adds `is-visible` to every `.reveal` element inside the page once it scrolls into view.
 * Pure CSS does the animation; without IntersectionObserver (or with reduced motion) nothing is hidden.
 */
export function useReveal(deps = []) {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal:not(.is-visible)')
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'))
      return undefined
    }
    const root = document.documentElement
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )
    els.forEach((el) => io.observe(el))
    root.classList.add('reveal-on') // only now is it safe to hide not-yet-seen content
    return () => {
      io.disconnect()
      root.classList.remove('reveal-on')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller decides when to re-scan
  }, deps)
}
