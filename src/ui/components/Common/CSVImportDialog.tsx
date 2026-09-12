import { FileCsvIcon, FileTextIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
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
import type { Budget, Transaction } from '@/domain/entities'
import { formatCurrency } from '@/lib/currency'
import { useFinance } from '@/ui/context'

type SkippedInfo = {
  lines: number[]
  count: number
}

type PreviewData = {
  type: 'json' | 'csv'
  transactions: Transaction[]
  budgets: Budget[]
  filename: string
  skipped: SkippedInfo
}

export default function CSVImportDialog({
  open,
  onOpenChange,
  mode = 'all',
  onImported,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode?: 'csv' | 'all'
  onImported?: () => void
}) {
  const { dispatch } = useFinance()
  const fileRef = useRef<HTMLInputElement>(null)
  const readerRef = useRef<FileReader | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      readerRef.current?.abort()
    }
  }, [])

  function handleFile(file: File) {
    setError(null)
    setPreview(null)
    const reader = new FileReader()
    readerRef.current = reader
    reader.onload = () => {
      try {
        const content = reader.result as string
        const isJson = file.name.toLowerCase().endsWith('.json')
        const isCsv = file.name.toLowerCase().endsWith('.csv')
        if (mode === 'csv' && !isCsv) {
          setError(
            isJson
              ? 'Backup (.json) imports live on the Actions tab'
              : 'Unsupported file format. Use .csv',
          )
          return
        }
        if (isJson) {
          const { data, skippedTransactions, skippedBudgets } = importJSON(content)
          setPreview({
            type: 'json',
            transactions: data.transactions,
            budgets: data.budgets,
            skipped: { lines: [], count: skippedTransactions + skippedBudgets },
            filename: file.name,
          })
        } else if (file.name.endsWith('.csv')) {
          const { transactions, skippedRows } = importCSV(content)
          setPreview({
            type: 'csv',
            transactions,
            budgets: [],
            skipped: { lines: skippedRows, count: skippedRows.length },
            filename: file.name,
          })
        } else {
          setError(
            mode === 'csv'
              ? 'Unsupported file format. Use .csv'
              : 'Unsupported file format. Use .json or .csv',
          )
        }
      } catch (err) {
        const msg = (err as Error).message
        if (msg.includes('Unexpected token') || msg.includes('JSON')) {
          setError(
            mode === 'csv'
              ? 'The file format is invalid. Make sure your .csv file has the correct structure: columns like date, description, amount, category, paymentMethod, type.'
              : 'The file format is invalid. Make sure your .json or .csv file has the correct structure: columns like date, description, amount, category, paymentMethod, type.',
          )
        } else {
          setError(msg)
        }
      }
    }
    reader.readAsText(file)
  }

  function handleImport() {
    if (!preview) return
    dispatch({
      type: 'ADD_TRANSACTIONS',
      payload: preview.transactions.map((t) => ({ ...t, id: t.id || uuid() })),
    })
    for (const budget of preview.budgets) {
      dispatch({ type: 'UPSERT_BUDGET', payload: budget })
    }
    setPreview(null)
    onOpenChange(false)
    onImported?.()
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'csv' ? 'Import from CSV' : 'Import Data'}</DialogTitle>
          <DialogDescription>
            {mode === 'csv'
              ? 'Drop a .csv exchange file here to import transactions.'
              : 'Drop a .json backup (transactions + budgets) or a .csv exchange file (transactions only).'}
          </DialogDescription>
        </DialogHeader>

        {!preview && !error && (
          <button
            type="button"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-border rounded-none p-8 text-center space-y-3 cursor-pointer hover:bg-muted/50 transition-colors w-full"
            onClick={() => fileRef.current?.click()}
          >
            <div className="flex justify-center gap-2 text-muted-foreground">
              {mode === 'csv' ? (
                <FileCsvIcon size={24} />
              ) : (
                <>
                  <FileCsvIcon size={24} />
                  <FileTextIcon size={24} />
                </>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {mode === 'csv'
                ? 'Drop a .csv file here, or click to browse'
                : 'Drop a .json or .csv file here, or click to browse'}
            </p>
            <input
              ref={fileRef}
              type="file"
              accept={mode === 'csv' ? '.csv' : '.json,.csv'}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
              className="hidden"
            />
          </button>
        )}

        {error && (
          <div className="bg-destructive/10 text-destructive text-xs p-3 rounded-none">
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
              {preview.filename} — {preview.transactions.length} transaction
              {preview.transactions.length !== 1 ? 's' : ''} and {preview.budgets.length} budget
              {preview.budgets.length !== 1 ? 's' : ''} found
              {preview.skipped.count > 0 &&
                preview.skipped.lines.length > 0 &&
                ` — ${preview.skipped.count} row${preview.skipped.count !== 1 ? 's' : ''} skipped (malformed): line${preview.skipped.lines.length !== 1 ? 's' : ''} ${preview.skipped.lines.join(', ')}`}
              {preview.skipped.count > 0 &&
                preview.skipped.lines.length === 0 &&
                ` — ${preview.skipped.count} entr${preview.skipped.count !== 1 ? 'ies' : 'y'} skipped (invalid format)`}
            </p>
            <div className="max-h-60 overflow-y-auto border border-border">
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
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setPreview(null)
                  setError(null)
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleImport}>Import</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
