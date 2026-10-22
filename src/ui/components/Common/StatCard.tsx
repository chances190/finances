import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: ReactNode
  icon?: ReactNode
  valueClassName?: string
  className?: string
}

export default function StatCard({ label, value, icon, valueClassName, className }: StatCardProps) {
  return (
    <div className={cn('space-y-1 border bg-card p-3 sm:p-4', className)}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          'text-lg font-bold whitespace-nowrap text-foreground sm:text-xl',
          valueClassName,
        )}
      >
        {value}
      </div>
    </div>
  )
}
