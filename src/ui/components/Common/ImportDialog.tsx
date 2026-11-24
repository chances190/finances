import { FileCodeIcon, FileCsvIcon, FileTextIcon } from '@phosphor-icons/react'
import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { importJSON } from '@/data/backup/json'
import { importCSV } from '@/data/exchange/csv'
import { importOFX } from '@/data/exchange/ofx'
import {
  buildImportCommit,
  type ImportPlan,
  isBlocked,
  type MatchAction,
  planImport,
} from '@/data/exchange/reconcile'
import type { Budget } from '@/domain/entities'
import {
  categoryOf,
  MOVEMENT_KIND_LABELS,
  type Movement,
  movementTotal,
  paymentMethodOf,
} from '@/domain/ledger'
import { formatCurrency } from '@/lib/currency'
import ConfirmDialog from '@/ui/components/Common/ConfirmDialog'
import { useFinance } from '@/ui/context'

type SkippedInfo = {
  entries: Array<{ label: string; reason: string }>
}

type PreviewData = {
  movements: Movement[]
  budgets: Budget[]
  plans: ImportPlan[]
  label: string
  fullBackup: boolean
  source?: 'card' | 'bank'
  skipped: SkippedInfo
}

function decodeOFX(buffer: ArrayBuffer): string {
  const header = new TextDecoder('latin1').decode(buffer.slice(0, 512))
  const encoding = /ENCODING:([\w-]+)/i.exec(header)?.[1]?.toLowerCase()
  const charset = /CHARSET:([\w-]+)/i.exec(header)?.[1]?.toLowerCase()
  const utf8 = encoding === 'utf-8' || charset === 'utf-8'
  return new TextDecoder(utf8 ? 'utf-8' : 'windows-1252').decode(buffer)
}

function previewPayment(movement: Movement): string {
  return paymentMethodOf(movement) ?? '—'
}

function previewKind(movement: Movement): string {
  return MOVEMENT_KIND_LABELS[movement.kind]
}

export default function ImportDialog({
  open,
  onOpenChange,
  mode = 'transactions',
  onImported,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode?: 'transactions' | 'backup'
  onImported?: () => void
}) {
  const { state, dispatch } = useFinance()
  const fileRef = useRef<HTMLInputElement>(null)
  const readersRef = useRef<FileReader[]>([])
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const abortReaders = useCallback(() => {
    for (const reader of readersRef.current) reader.abort()
    readersRef.current = []
  }, [])

  useEffect(() => {
    return () => {
      abortReaders()
    }
  }, [abortReaders])

  useEffect(() => {
    setShowConfirm(false)
    if (open) {
      setPreview(null)
      setError(null)
    } else {
      abortReaders()
    }
  }, [open, abortReaders])

  function readFile(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      readersRef.current.push(reader)
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error ?? new Error(`Could not read ${file.name}`))
      reader.readAsArrayBuffer(file)
    })
  }

  async function handleFiles(files: File[]) {
    setError(null)
    setPreview(null)
    if (files.length === 0) return

    const isJson = files.some((file) => file.name.toLowerCase().endsWith('.json'))
    if (isJson && files.length > 1) {
      setError('Import a .json backup on its own — it replaces the current data.')
      return
    }
    if (mode === 'transactions' && isJson) {
      setError('Use Import Backup (.json) on the Actions tab for .json backups')
      return
    }
    if (mode === 'backup' && !files.every((file) => file.name.toLowerCase().endsWith('.json'))) {
      setError(
        'The backup import accepts .json only. Use Transactions → Add → Import for .csv or .ofx files.',
      )
      return
    }

    try {
      const movements: Movement[] = []
      const budgets: Budget[] = []
      const skipped: SkippedInfo['entries'] = []
      let fullBackup = false
      let source: 'card' | 'bank' | undefined
      const prefix = (file: File, label: string) =>
        files.length > 1 ? `${file.name} — ${label}` : label

      for (const file of files) {
        const name = file.name.toLowerCase()
        if (!name.endsWith('.json') && !name.endsWith('.csv') && !name.endsWith('.ofx')) {
          setError(`Unsupported file format: ${file.name}`)
          return
        }

        const buffer = await readFile(file)
        const content = name.endsWith('.ofx')
          ? decodeOFX(buffer)
          : new TextDecoder('utf-8').decode(buffer)

        if (name.endsWith('.json')) {
          const result = importJSON(content)
          fullBackup = true
          movements.push(...result.data.movements)
          budgets.push(...result.data.budgets)
          skipped.push(
            ...result.skippedMovements.map((entry) => ({
              label: prefix(file, `transaction #${entry.index + 1}`),
              reason: entry.reason,
            })),
            ...Array.from({ length: result.skippedBudgets }, (_, index) => ({
              label: prefix(file, `budget #${index + 1}`),
              reason: 'invalid budget format',
            })),
          )
        } else if (name.endsWith('.csv')) {
          const result = importCSV(content)
          movements.push(...result.movements)
          skipped.push(
            ...result.skippedRows.map((entry) => ({
              label: prefix(file, `line ${entry.line}`),
              reason: entry.reason,
            })),
          )
        } else {
          const result = importOFX(content, [...state.movements, ...movements])
          if (files.length === 1) source = result.source
          movements.push(...result.movements)
          skipped.push(
            ...result.skipped.map((entry) => ({
              label: prefix(file, entry.label),
              reason: entry.reason,
            })),
          )
        }
      }

      setPreview({
        movements,
        budgets,
        plans: fullBackup ? [] : planImport(movements, state.movements),
        label: files.length === 1 ? files[0].name : `${files.length} files`,
        fullBackup,
        source,
        skipped: { entries: skipped },
      })
    } catch (caught) {
      const message = (caught as Error).message
      setError(
        message.includes('Unexpected token') || message.includes('JSON')
          ? 'The file format is invalid. Make sure your .json or .csv file has the correct structure: columns like date, description, amount, category, paymentMethod, type.'
          : message,
      )
    }
  }

  function handleImport() {
    if (!preview) return
    const commit = preview.fullBackup ? null : buildImportCommit(preview.plans, state.movements)
    if (commit && commit.unresolved > 0) return

    startTransition(() => {
      if (!commit) {
        dispatch({
          type: 'IMPORT',
          payload: { movements: preview.movements, budgets: preview.budgets },
        })
        return
      }
      if (commit.additions.length > 0) {
        dispatch({ type: 'ADD_MOVEMENTS', payload: commit.additions })
      }
      for (const movement of commit.updates) {
        dispatch({ type: 'UPDATE_MOVEMENT', payload: movement })
      }
      for (const budget of preview.budgets) {
        dispatch({ type: 'UPSERT_BUDGET', payload: budget })
      }
    })
    setPreview(null)
    onOpenChange(false)
    onImported?.()
  }

  function requestImport() {
    if (!preview) return
    if (preview.fullBackup) {
      setShowConfirm(true)
      return
    }
    const commit = buildImportCommit(preview.plans, state.movements)
    if (commit.unresolved > 0) return
    handleImport()
  }

  function updatePlan(movementId: string, patch: Partial<ImportPlan>) {
    setPreview((current) =>
      current
        ? {
            ...current,
            plans: current.plans.map((plan) =>
              plan.movement.id === movementId ? { ...plan, ...patch } : plan,
            ),
          }
        : current,
    )
  }

  const unresolved = preview ? preview.plans.filter(isBlocked).length : 0
  const matched = preview ? preview.plans.filter((plan) => plan.candidates.length > 0).length : 0

  function renderAction(plan: ImportPlan) {
    if (plan.candidates.length === 0) {
      return <span className="text-xs text-muted-foreground">New</span>
    }

    return (
      <div className="w-40 max-w-full space-y-1">
        {plan.candidates.length > 1 ? (
          <select
            aria-label="Choose the purchase to match"
            value={plan.targetId ?? ''}
            onChange={(event) =>
              updatePlan(plan.movement.id, { targetId: event.target.value || null })
            }
            className="h-7 w-full min-w-0 border border-input bg-transparent px-1 text-xs"
          >
            <option value="">Choose purchase…</option>
            {plan.candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.description} · {candidate.date} ·{' '}
                {formatCurrency(movementTotal(candidate))}
              </option>
            ))}
          </select>
        ) : (
          <p className="truncate text-[11px] text-muted-foreground">
            Matches {plan.candidates[0].description} · {plan.candidates[0].date}
          </p>
        )}
        <select
          aria-label="What to do with this match"
          value={plan.action ?? ''}
          onChange={(event) =>
            updatePlan(plan.movement.id, {
              action: (event.target.value || null) as MatchAction | null,
            })
          }
          className="h-7 w-full min-w-0 border border-input bg-transparent px-1 text-xs"
        >
          {plan.candidates.length > 1 && <option value="">Choose…</option>}
          <option value="link">Use existing</option>
          <option value="overwrite">Replace existing</option>
          <option value="keep">Add separately</option>
        </select>
      </div>
    )
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault()
    void handleFiles(Array.from(event.dataTransfer.files))
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="grid max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {mode === 'transactions' ? 'Import transactions' : 'Import backup'}
            </DialogTitle>
            <DialogDescription>
              {mode === 'transactions'
                ? 'Drop .csv exchange files or bank .ofx statements here.'
                : 'Drop a .json backup (transactions + budgets). This replaces the current data.'}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 space-y-3 overflow-y-auto">
            {!preview && !error && (
              <button
                type="button"
                onDrop={handleDrop}
                onDragOver={(event) => event.preventDefault()}
                className="w-full cursor-pointer space-y-3 border-2 border-dashed border-border p-6 text-center transition-colors hover:bg-muted/50 sm:p-8"
                onClick={() => fileRef.current?.click()}
              >
                <div className="flex justify-center gap-2 text-muted-foreground">
                  {mode === 'transactions' ? (
                    <>
                      <FileCsvIcon size={24} />
                      <FileCodeIcon size={24} />
                    </>
                  ) : (
                    <FileTextIcon size={24} />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {mode === 'transactions'
                    ? 'Drop .csv or .ofx files here, or click to browse'
                    : 'Drop a .json file here, or click to browse'}
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept={mode === 'transactions' ? '.csv,.ofx' : '.json'}
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? [])
                    event.target.value = ''
                    void handleFiles(files)
                  }}
                  className="hidden"
                />
              </button>
            )}

            {error && (
              <div className="bg-destructive/10 p-3 text-xs text-destructive">
                {error}
                <Button
                  variant="ghost"
                  size="xs"
                  className="ml-2"
                  onClick={() => setError(null)}
                  aria-label="Dismiss error"
                >
                  Dismiss
                </Button>
              </div>
            )}

            {preview && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  {preview.label} — {preview.movements.length} transaction
                  {preview.movements.length !== 1 ? 's' : ''} found
                  {preview.fullBackup &&
                    ` and ${preview.budgets.length} budget${preview.budgets.length !== 1 ? 's' : ''}`}
                  {preview.source &&
                    ` (${preview.source === 'card' ? 'credit card' : 'bank account'})`}
                  {matched > 0 && ` — ${matched} matched existing`}
                  {preview.skipped.entries.length > 0 &&
                    ` — ${preview.skipped.entries.length} skipped`}
                </p>
                {preview.skipped.entries.length > 0 && (
                  <div className="max-h-24 space-y-0.5 overflow-y-auto bg-muted/50 p-2 text-xs">
                    {preview.skipped.entries.map((entry, index) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: static display list
                      <div key={index} className="text-muted-foreground">
                        <span className="font-medium">{entry.label}:</span> {entry.reason}
                      </div>
                    ))}
                  </div>
                )}
                <div className="max-h-[60svh] space-y-2 overflow-y-auto sm:hidden">
                  {preview.fullBackup
                    ? preview.movements.slice(0, 50).map((movement) => (
                        <div key={movement.id} className="border border-border p-2">
                          <div className="flex justify-between gap-2">
                            <span className="min-w-0 truncate text-sm font-medium">
                              {movement.description}
                            </span>
                            <span className="shrink-0 font-mono text-sm">
                              {formatCurrency(movementTotal(movement))}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {movement.date} · {previewKind(movement)} · {previewPayment(movement)}
                            {categoryOf(movement) ? ` · ${categoryOf(movement)}` : ''}
                          </p>
                        </div>
                      ))
                    : preview.plans.map((plan) => {
                        const movement = plan.movement
                        return (
                          <div
                            key={movement.id}
                            className={`space-y-2 border p-2 ${isBlocked(plan) ? 'border-destructive/50 bg-destructive/5' : 'border-border'}`}
                          >
                            <div className="flex justify-between gap-2">
                              <span className="min-w-0 break-words text-sm font-medium">
                                {movement.description}
                              </span>
                              <span className="shrink-0 font-mono text-sm">
                                {formatCurrency(movementTotal(movement))}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {movement.date} · {MOVEMENT_KIND_LABELS[movement.kind]} ·{' '}
                              {previewPayment(movement)}
                              {categoryOf(movement) ? ` · ${categoryOf(movement)}` : ''}
                            </p>
                            {renderAction(plan)}
                          </div>
                        )
                      })}
                  {preview.fullBackup && preview.movements.length > 50 && (
                    <p className="p-2 text-center text-xs text-muted-foreground">
                      ...and {preview.movements.length - 50} more
                    </p>
                  )}
                </div>
                <div className="hidden max-h-64 overflow-y-auto border border-border sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-20">Kind</TableHead>
                        <TableHead className="w-28">Payment</TableHead>
                        <TableHead className="w-24 text-right">Amount</TableHead>
                        {!preview.fullBackup && <TableHead className="w-44">Action</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.fullBackup
                        ? preview.movements.slice(0, 50).map((movement) => (
                            <TableRow key={movement.id}>
                              <TableCell className="text-muted-foreground">
                                {movement.date}
                              </TableCell>
                              <TableCell className="max-w-40 truncate">
                                {movement.description}
                              </TableCell>
                              <TableCell>{previewKind(movement)}</TableCell>
                              <TableCell>{previewPayment(movement)}</TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(movementTotal(movement))}
                              </TableCell>
                            </TableRow>
                          ))
                        : preview.plans.map((plan) => {
                            const movement = plan.movement
                            return (
                              <TableRow
                                key={movement.id}
                                className={isBlocked(plan) ? 'bg-destructive/5' : undefined}
                              >
                                <TableCell className="text-muted-foreground">
                                  {movement.date}
                                </TableCell>
                                <TableCell className="max-w-40 truncate">
                                  {movement.description}
                                </TableCell>
                                <TableCell>{previewKind(movement)}</TableCell>
                                <TableCell>{previewPayment(movement)}</TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatCurrency(movementTotal(movement))}
                                </TableCell>
                                <TableCell>{renderAction(plan)}</TableCell>
                              </TableRow>
                            )
                          })}
                      {preview.fullBackup && preview.movements.length > 50 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            ...and {preview.movements.length - 50} more
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {unresolved > 0 && (
                    <p className="mr-auto text-xs text-destructive">
                      Choose how to handle each highlighted match.
                    </p>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPreview(null)
                      setError(null)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={requestImport} disabled={unresolved > 0}>
                    {unresolved > 0
                      ? `Resolve ${unresolved} match${unresolved !== 1 ? 'es' : ''}`
                      : 'Import'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Replace all data?"
        message="Importing a backup replaces every current movement and budget. This cannot be undone with Ctrl+Z."
        confirmLabel="Replace data"
        destructive
        onConfirm={handleImport}
      />
    </>
  )
}
