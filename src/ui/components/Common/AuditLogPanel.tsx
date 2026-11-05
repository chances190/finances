import {
  ArrowClockwiseIcon,
  ArrowCounterClockwiseIcon,
  ClockIcon,
  TrashIcon,
} from '@phosphor-icons/react'
import { lazy, Suspense, useState } from 'react'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/ui/components/Common/ConfirmDialog'
import ExportImport from '@/ui/components/Common/ExportImport'
import { useFinance } from '@/ui/context'

const ImportDialog = lazy(() => import('@/ui/components/Common/ImportDialog'))

export default function AuditLogPanel() {
  const { state, dispatch } = useFinance()
  const [showImport, setShowImport] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

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
              onClick={() => setShowClearConfirm(true)}
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

      <div className="mt-6 space-y-3 border-t pt-4">
        <h3 className="text-sm font-semibold text-foreground">Data</h3>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Export</p>
          <ExportImport />
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Import</p>
          <Button variant="outline" size="xs" onClick={() => setShowImport(true)}>
            Import Backup (.json)
          </Button>
        </div>
        {showImport && (
          <Suspense fallback={null}>
            <ImportDialog open onOpenChange={setShowImport} mode="backup" />
          </Suspense>
        )}
      </div>

      <ConfirmDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title="Clear action history?"
        message="This removes the history used to undo past actions. It does not change transactions or budgets."
        confirmLabel="Clear history"
        onConfirm={() => dispatch({ type: 'CLEAR_AUDIT' })}
      />
    </div>
  )
}
