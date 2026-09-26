interface EmptyStateProps {
  message: string
  variant?: 'block' | 'cell'
}

export default function EmptyState({ message, variant = 'block' }: EmptyStateProps) {
  if (variant === 'cell') {
    return <div className="text-center text-muted-foreground py-8">{message}</div>
  }
  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
      {message}
    </div>
  )
}
