import {
  ArrowClockwiseIcon,
  ArrowCounterClockwiseIcon,
  ClockIcon,
  TrashIcon,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { useFinance } from '@/ui/context'

export default function AuditLogPanel() {
  const { state, dispatch } = useFinance()

  function handleUndo(entryId: string) {
    dispatch({ type: 'UNDO', payload: entryId })
  }

  function handleRedo() {
    dispatch({ type: 'REDO' })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-1">
          <ClockIcon /> Actions
        </h2>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="xs"
            onClick={handleRedo}
            disabled={state.redoStack.length === 0}
            aria-label="Redo"
          >
            <ArrowClockwiseIcon /> Redo
          </Button>
          {state.auditLog.length > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => dispatch({ type: 'CLEAR_AUDIT' })}
              aria-label="Clear history"
            >
              <TrashIcon /> Clear
            </Button>
          )}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground mb-2">
        Tip: Ctrl+Z to undo, Ctrl+Shift+Z to redo
      </p>

      {state.auditLog.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          No actions recorded yet. Actions are recorded when you add, edit, or delete transactions
          and budgets.
        </p>
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
              <Button
                variant="ghost"
                size="xs"
                onClick={() => handleUndo(entry.id)}
                aria-label="Undo this action"
              >
                <ArrowCounterClockwiseIcon /> Undo
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
