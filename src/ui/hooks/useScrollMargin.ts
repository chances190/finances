import { type RefObject, useLayoutEffect, useState } from 'react'

export function useScrollMargin(ref: RefObject<HTMLElement | null>): number {
  const [margin, setMargin] = useState(0)

  useLayoutEffect(() => {
    const measure = () => {
      const element = ref.current
      if (!element) return
      setMargin(element.getBoundingClientRect().top + window.scrollY)
    }

    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [ref])

  return margin
}
