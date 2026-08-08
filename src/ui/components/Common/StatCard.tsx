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
    <div className={cn('border bg-card p-4 space-y-1', className)}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={cn('text-xl font-bold text-foreground', valueClassName)}>{value}</div>
    </div>
  )
}
