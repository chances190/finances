import { ArrowCounterClockwiseIcon, ClockIcon, XIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { useFinance } from '@/ui/context'

export default function AuditLogPanel({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useFinance()

  function handleUndo(entryId: string) {
    dispatch({ type: 'UNDO', payload: entryId })
  }

  return (
    <div className="border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold flex items-center gap-1">
          <ClockIcon /> Action History
        </h3>
        <div className="flex gap-2">
          {state.auditLog.length > 0 && (
            <Button variant="ghost" size="xs" onClick={() => dispatch({ type: 'CLEAR_AUDIT' })}>
              Clear
            </Button>
          )}
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <XIcon />
          </Button>
        </div>
      </div>

      {state.auditLog.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">No actions recorded yet.</p>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {state.auditLog.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between py-1.5 px-2 hover:bg-muted text-xs"
            >
              <div className="flex-1 min-w-0">
                <span className="truncate block">{entry.description}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(entry.timestamp).toLocaleString()}
                </span>
              </div>
              <Button variant="ghost" size="xs" onClick={() => handleUndo(entry.id)}>
                <ArrowCounterClockwiseIcon /> Undo
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
