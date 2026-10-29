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
import type { Budget, Transaction } from '@/domain/entities'
import { formatCurrency } from '@/lib/currency'
import ConfirmDialog from '@/ui/components/Common/ConfirmDialog'
import { useFinance } from '@/ui/context'

type SkippedInfo = {
  entries: Array<{ label: string; reason: string }>
}

type PreviewData = {
  transactions: Transaction[]
  budgets: Budget[]
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
      const transactions: Transaction[] = []
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
          const { data, skippedTransactions, skippedBudgets } = importJSON(content)
          fullBackup = true
          transactions.push(...data.transactions)
          budgets.push(...data.budgets)
          skipped.push(
            ...skippedTransactions.map((entry) => ({
              label: prefix(file, `transaction #${entry.index + 1}`),
              reason: entry.reason,
            })),
            ...Array.from({ length: skippedBudgets }, (_, index) => ({
              label: prefix(file, `budget #${index + 1}`),
              reason: 'invalid budget format',
            })),
          )
        } else if (name.endsWith('.csv')) {
          const { transactions: parsed, skippedRows } = importCSV(content)
          transactions.push(...parsed)
          skipped.push(
            ...skippedRows.map((entry) => ({
              label: prefix(file, `line ${entry.line}`),
              reason: entry.reason,
            })),
          )
        } else if (name.endsWith('.ofx')) {
          const result = importOFX(content, [...state.transactions, ...transactions])
          if (files.length === 1) source = result.source
          transactions.push(...result.transactions)
          skipped.push(
            ...result.skipped.map((entry) => ({
              label: prefix(file, entry.label),
              reason: entry.reason,
            })),
          )
        } else {
          setError(`Unsupported file format: ${file.name}`)
          return
        }
      }

      setPreview({
        transactions,
        budgets,
        label: files.length === 1 ? files[0].name : `${files.length} files`,
        fullBackup,
        source,
        skipped: { entries: skipped },
      })
    } catch (err) {
      const message = (err as Error).message
      setError(
        message.includes('Unexpected token') || message.includes('JSON')
          ? 'The file format is invalid. Make sure your .json or .csv file has the correct structure: columns like date, description, amount, category, paymentMethod, type.'
          : message,
      )
    }
  }

  function handleImport() {
    if (!preview) return
    startTransition(() => {
      if (preview.fullBackup) {
        dispatch({
          type: 'IMPORT',
          payload: { transactions: preview.transactions, budgets: preview.budgets },
        })
      } else {
        dispatch({
          type: 'ADD_TRANSACTIONS',
          payload: preview.transactions.map((transaction) => ({
            ...transaction,
            id: transaction.id || crypto.randomUUID(),
          })),
        })
        for (const budget of preview.budgets) {
          dispatch({ type: 'UPSERT_BUDGET', payload: budget })
        }
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
    handleImport()
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    void handleFiles(Array.from(e.dataTransfer.files))
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="grid max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-2xl">
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
                onDragOver={(e) => e.preventDefault()}
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
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? [])
                    e.target.value = ''
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
                  {preview.label} — {preview.transactions.length} transaction
                  {preview.transactions.length !== 1 ? 's' : ''} found
                  {preview.fullBackup &&
                    ` and ${preview.budgets.length} budget${preview.budgets.length !== 1 ? 's' : ''}`}
                  {preview.source &&
                    ` (${preview.source === 'card' ? 'credit card' : 'bank account'})`}
                  {preview.skipped.entries.length > 0 &&
                    ` — ${preview.skipped.entries.length} skipped`}
                </p>
                {preview.skipped.entries.length > 0 && (
                  <div className="max-h-24 space-y-0.5 overflow-y-auto bg-muted/50 p-2 text-xs">
                    {preview.skipped.entries.map((s, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: static display list
                      <div key={i} className="text-muted-foreground">
                        <span className="font-medium">{s.label}:</span> {s.reason}
                      </div>
                    ))}
                  </div>
                )}
                <div className="max-h-64 overflow-y-auto border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Payment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.transactions.slice(0, 50).map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="text-muted-foreground">{t.date}</TableCell>
                          <TableCell>{t.type}</TableCell>
                          <TableCell className="max-w-32 truncate">{t.description}</TableCell>
                          <TableCell>{t.category}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(t.amount)}
                          </TableCell>
                          <TableCell>{t.paymentMethod}</TableCell>
                        </TableRow>
                      ))}
                      {preview.transactions.length > 50 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            ...and {preview.transactions.length - 50} more
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPreview(null)
                      setError(null)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={requestImport}>Import</Button>
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
        message="Importing a backup replaces every current transaction and budget. This cannot be undone with Ctrl+Z."
        confirmLabel="Replace data"
        destructive
        onConfirm={handleImport}
      />
    </>
  )
}
