export function initViewport(): () => void {
  const viewport = window.visualViewport
  if (!viewport) return () => {}

  const root = document.documentElement
  const update = () => {
    const covered = window.innerHeight - viewport.height - viewport.offsetTop
    root.style.setProperty('--sheet-lift', `${Math.max(0, covered)}px`)
    root.style.setProperty('--sheet-height', `${viewport.height}px`)
  }

  update()
  viewport.addEventListener('resize', update)
  viewport.addEventListener('scroll', update)

  return () => {
    viewport.removeEventListener('resize', update)
    viewport.removeEventListener('scroll', update)
    root.style.removeProperty('--sheet-lift')
    root.style.removeProperty('--sheet-height')
  }
}
