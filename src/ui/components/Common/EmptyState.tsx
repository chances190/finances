import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  message: string
  variant?: 'block' | 'cell'
  action?: { label: string; onClick: () => void }
}

export default function EmptyState({ message, variant = 'block', action }: EmptyStateProps) {
  if (variant === 'cell' && !action) {
    return <div className="py-8 text-center text-muted-foreground">{message}</div>
  }
  if (variant === 'cell') {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
        <p>{message}</p>
        {action && (
          <Button variant="outline" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </div>
    )
  }
  if (!action) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        {message}
      </div>
    )
  }
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      <p>{message}</p>
      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
