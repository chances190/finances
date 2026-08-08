import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface SegmentedControlOption {
  value: string
  label: string
  icon?: ReactNode
}

interface SegmentedControlProps {
  options: SegmentedControlOption[]
  value: string
  onValueChange: (value: string) => void
  className?: string
  'aria-label'?: string
}

export function SegmentedControl({
  options,
  value,
  onValueChange,
  className,
  ...props
}: SegmentedControlProps) {
  return (
    <div
      role="radiogroup"
      className={cn('inline-flex items-center gap-1 rounded-none bg-muted p-1', className)}
      {...props}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-none px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors',
              selected
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
