interface EmptyStateProps {
  message: string
}

export default function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
      {message}
    </div>
  )
}
