import type { ReactNode } from 'react'
import { useInView } from '@/ui/hooks/useInView'

export default function LazyChart({
  className,
  children,
}: {
  className: string
  children: ReactNode
}) {
  const { ref, inView } = useInView<HTMLDivElement>()

  return (
    <div ref={ref} className={className}>
      {inView ? children : null}
    </div>
  )
}
