const NAV_H = 64 // the fixed header (h-16)

/** Smooth-scrolls to a page section. #projects is framed around the Flux
 *  Galaxy itself — its bottom edge on the viewport's bottom edge, as long as
 *  that still leaves the section heading visible below the fixed header —
 *  rather than the section's top padding, which left the galaxy cut off. */
export function scrollToSection(href: string) {
  const el = document.querySelector(href)
  if (!el) return
  const galaxy = href === '#projects' ? document.getElementById('flux-galaxy') : null
  const heading = el.querySelector('h2')
  if (!galaxy || !heading) {
    el.scrollIntoView({ behavior: 'smooth' })
    return
  }
  const fitGalaxy = galaxy.getBoundingClientRect().bottom - window.innerHeight
  const keepHeading = heading.getBoundingClientRect().top - NAV_H - 12
  window.scrollTo({ top: window.scrollY + Math.min(fitGalaxy, keepHeading), behavior: 'smooth' })
}
