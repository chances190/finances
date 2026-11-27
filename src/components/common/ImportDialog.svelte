<script lang="ts">
import { FileCodeIcon, FileSpreadsheetIcon, FileTextIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/svelte'
import { onDestroy } from 'svelte'
import ConfirmDialog from '@/components/common/ConfirmDialog.svelte'
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
import { finance } from '@/lib/stores/finance.svelte'

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

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode?: 'transactions' | 'backup'
  onImported?: () => void
}

let { open, onOpenChange, mode = 'transactions', onImported }: Props = $props()

const financeState = $derived(finance.state)

let fileInput = $state<HTMLInputElement | null>(null)
let preview = $state<PreviewData | null>(null)
let error = $state<string | null>(null)
let showConfirm = $state(false)
const readers: FileReader[] = []

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

function abortReaders() {
  for (const reader of readers) reader.abort()
  readers.length = 0
}

onDestroy(abortReaders)

function readFile(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    readers.push(reader)
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error ?? new Error(`Could not read ${file.name}`))
    reader.readAsArrayBuffer(file)
  })
}

async function handleFiles(files: File[]) {
  error = null
  preview = null
  if (files.length === 0) return

  const isJson = files.some((file) => file.name.toLowerCase().endsWith('.json'))
  if (isJson && files.length > 1) {
    error = 'Import a .json backup on its own — it replaces the current data.'
    return
  }
  if (mode === 'transactions' && isJson) {
    error = 'Use Import Backup (.json) on the Actions tab for .json backups'
    return
  }
  if (mode === 'backup' && !files.every((file) => file.name.toLowerCase().endsWith('.json'))) {
    error =
      'The backup import accepts .json only. Use Transactions → Add → Import for .csv or .ofx files.'
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
        error = `Unsupported file format: ${file.name}`
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
        const result = importOFX(content, [...financeState.movements, ...movements])
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

    preview = {
      movements,
      budgets,
      plans: fullBackup ? [] : planImport(movements, financeState.movements),
      label: files.length === 1 ? files[0].name : `${files.length} files`,
      fullBackup,
      source,
      skipped: { entries: skipped },
    }
  } catch (caught) {
    const message = (caught as Error).message
    error =
      message.includes('Unexpected token') || message.includes('JSON')
        ? 'The file format is invalid. Make sure your .json or .csv file has the correct structure: columns like date, description, amount, category, paymentMethod, type.'
        : message
  }
}

function handleImport() {
  if (!preview) return
  const commit = preview.fullBackup
    ? null
    : buildImportCommit(preview.plans, financeState.movements)
  if (commit && commit.unresolved > 0) return

  if (!commit) {
    finance.dispatch({
      type: 'IMPORT',
      payload: { movements: preview.movements, budgets: preview.budgets },
    })
  } else {
    if (commit.additions.length > 0) {
      finance.dispatch({ type: 'ADD_MOVEMENTS', payload: commit.additions })
    }
    for (const movement of commit.updates) {
      finance.dispatch({ type: 'UPDATE_MOVEMENT', payload: movement })
    }
    for (const budget of preview.budgets) {
      finance.dispatch({ type: 'UPSERT_BUDGET', payload: budget })
    }
  }
  preview = null
  onOpenChange(false)
  onImported?.()
}

function requestImport() {
  if (!preview) return
  if (preview.fullBackup) {
    showConfirm = true
    return
  }
  const commit = buildImportCommit(preview.plans, financeState.movements)
  if (commit.unresolved > 0) return
  handleImport()
}

function updatePlan(movementId: string, patch: Partial<ImportPlan>) {
  if (!preview) return
  preview = {
    ...preview,
    plans: preview.plans.map((plan) =>
      plan.movement.id === movementId ? { ...plan, ...patch } : plan,
    ),
  }
}

const unresolved = $derived(preview ? preview.plans.filter(isBlocked).length : 0)
const matched = $derived(
  preview ? preview.plans.filter((plan) => plan.candidates.length > 0).length : 0,
)
</script>

{#snippet planAction(plan: ImportPlan)}
  {#if plan.candidates.length === 0}
    <span class="text-xs text-muted-foreground">New</span>
  {:else}
    <div class="w-40 max-w-full space-y-1">
      {#if plan.candidates.length > 1}
        <select
          aria-label="Choose the purchase to match"
          value={plan.targetId ?? ''}
          onchange={(event) =>
            updatePlan(plan.movement.id, { targetId: event.currentTarget.value || null })}
          class="h-7 w-full min-w-0 border border-input bg-transparent px-1 text-xs"
        >
          <option value="">Choose purchase…</option>
          {#each plan.candidates as candidate (candidate.id)}
            <option value={candidate.id}>
              {candidate.description} · {candidate.date} ·
              {formatCurrency(movementTotal(candidate))}
            </option>
          {/each}
        </select>
      {:else}
        <p class="truncate text-[11px] text-muted-foreground">
          Matches {plan.candidates[0].description} · {plan.candidates[0].date}
        </p>
      {/if}
      <select
        aria-label="What to do with this match"
        value={plan.action ?? ''}
        onchange={(event) =>
          updatePlan(plan.movement.id, {
            action: (event.currentTarget.value || null) as MatchAction | null,
          })}
        class="h-7 w-full min-w-0 border border-input bg-transparent px-1 text-xs"
      >
        {#if plan.candidates.length > 1}
          <option value="">Choose…</option>
        {/if}
        <option value="link">Use existing</option>
        <option value="overwrite">Replace existing</option>
        <option value="keep">Add separately</option>
      </select>
    </div>
  {/if}
{/snippet}

<Dialog {open} {onOpenChange}>
  <DialogContent
    class="grid grid-rows-[auto_minmax(0,1fr)] sm:max-h-[calc(100svh-2rem)] sm:overflow-hidden sm:max-w-2xl"
  >
    <DialogHeader>
      <DialogTitle>{mode === 'transactions' ? 'Import transactions' : 'Import backup'}</DialogTitle>
      <DialogDescription>
        {mode === 'transactions'
          ? 'Drop .csv exchange files or bank .ofx statements here.'
          : 'Drop a .json backup (transactions + budgets). This replaces the current data.'}
      </DialogDescription>
    </DialogHeader>

    <div class="min-h-0 space-y-3 overflow-y-auto">
      {#if !preview && !error}
        <button
          type="button"
          ondragover={(event) => event.preventDefault()}
          ondrop={(event) => {
            event.preventDefault()
            handleFiles(Array.from(event.dataTransfer?.files ?? []))
          }}
          class="w-full cursor-pointer space-y-3 rounded-xl border-2 border-dashed border-border p-6 text-center transition-colors hover:bg-muted/50 sm:p-8"
          onclick={() => fileInput?.click()}
        >
          <div class="flex justify-center gap-2 text-muted-foreground">
            {#if mode === 'transactions'}
              <HugeiconsIcon icon={FileSpreadsheetIcon} size={24} />
              <HugeiconsIcon icon={FileCodeIcon} size={24} />
            {:else}
              <HugeiconsIcon icon={FileTextIcon} size={24} />
            {/if}
          </div>
          <p class="text-sm text-muted-foreground">
            {mode === 'transactions'
              ? 'Drop .csv or .ofx files here, or click to browse'
              : 'Drop a .json file here, or click to browse'}
          </p>
          <input
            bind:this={fileInput}
            type="file"
            multiple
            accept={mode === 'transactions' ? '.csv,.ofx' : '.json'}
            onchange={(event) => {
              const input = event.currentTarget
              const files = Array.from(input.files ?? [])
              input.value = ''
              handleFiles(files)
            }}
            class="hidden"
          >
        </button>
      {/if}

      {#if error}
        <div class="bg-destructive/10 p-3 text-xs text-destructive">
          {error}
          <Button
            variant="ghost"
            size="xs"
            class="ml-2"
            onclick={() => {
              error = null
            }}
            aria-label="Dismiss error"
          >
            Dismiss
          </Button>
        </div>
      {/if}

      {#if preview}
        <div class="space-y-3">
          <p class="text-xs text-muted-foreground">
            {preview.label} — {preview.movements.length} transaction{preview.movements.length !== 1
              ? 's'
              : ''}
            found{preview.fullBackup
              ? ` and ${preview.budgets.length} budget${preview.budgets.length !== 1 ? 's' : ''}`
              : ''}{preview.source
              ? ` (${preview.source === 'card' ? 'credit card' : 'bank account'})`
              : ''}{matched > 0 ? ` — ${matched} matched existing` : ''}{preview.skipped.entries
              .length > 0
              ? ` — ${preview.skipped.entries.length} skipped`
              : ''}
          </p>
          {#if preview.skipped.entries.length > 0}
            <div class="max-h-24 space-y-0.5 overflow-y-auto bg-muted/50 p-2 text-xs">
              {#each preview.skipped.entries as entry, index (index)}
                <div class="text-muted-foreground">
                  <span class="font-medium">{entry.label}:</span> {entry.reason}
                </div>
              {/each}
            </div>
          {/if}
          <div class="max-h-[60svh] space-y-2 overflow-y-auto sm:hidden">
            {#if preview.fullBackup}
              {#each preview.movements.slice(0, 50) as movement (movement.id)}
                <div class="panel-inset p-2">
                  <div class="flex justify-between gap-2">
                    <span class="min-w-0 truncate text-sm font-medium">{movement.description}</span>
                    <span class="shrink-0 font-mono text-sm">
                      {formatCurrency(movementTotal(movement))}
                    </span>
                  </div>
                  <p class="mt-1 text-xs text-muted-foreground">
                    {movement.date} · {previewKind(movement)} ·
                    {previewPayment(movement)}{categoryOf(movement)
                      ? ` · ${categoryOf(movement)}`
                      : ''}
                  </p>
                </div>
              {/each}
            {:else}
              {#each preview.plans as plan (plan.movement.id)}
                {@const movement = plan.movement}
                <div
                  class="space-y-2 rounded-lg border p-2 {isBlocked(plan)
                    ? 'border-destructive/50 bg-destructive/5'
                    : 'border-border'}"
                >
                  <div class="flex justify-between gap-2">
                    <span class="min-w-0 break-words text-sm font-medium">
                      {movement.description}
                    </span>
                    <span class="shrink-0 font-mono text-sm">
                      {formatCurrency(movementTotal(movement))}
                    </span>
                  </div>
                  <p class="text-xs text-muted-foreground">
                    {movement.date} · {MOVEMENT_KIND_LABELS[movement.kind]} ·
                    {previewPayment(movement)}{categoryOf(movement)
                      ? ` · ${categoryOf(movement)}`
                      : ''}
                  </p>
                  {@render planAction(plan)}
                </div>
              {/each}
            {/if}
            {#if preview.fullBackup && preview.movements.length > 50}
              <p class="p-2 text-center text-xs text-muted-foreground">
                ...and {preview.movements.length - 50} more
              </p>
            {/if}
          </div>
          <div
            class="hidden max-h-64 overflow-y-auto rounded-lg border border-border bg-card sm:block"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="w-24">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead class="w-20">Kind</TableHead>
                  <TableHead class="w-28">Payment</TableHead>
                  <TableHead class="w-24 text-right">Amount</TableHead>
                  {#if !preview.fullBackup}
                    <TableHead class="w-44">Action</TableHead>
                  {/if}
                </TableRow>
              </TableHeader>
              <TableBody>
                {#if preview.fullBackup}
                  {#each preview.movements.slice(0, 50) as movement (movement.id)}
                    <TableRow>
                      <TableCell class="text-muted-foreground">{movement.date}</TableCell>
                      <TableCell class="max-w-40 truncate">{movement.description}</TableCell>
                      <TableCell>{previewKind(movement)}</TableCell>
                      <TableCell>{previewPayment(movement)}</TableCell>
                      <TableCell class="text-right font-mono">
                        {formatCurrency(movementTotal(movement))}
                      </TableCell>
                    </TableRow>
                  {/each}
                {:else}
                  {#each preview.plans as plan (plan.movement.id)}
                    {@const movement = plan.movement}
                    <TableRow class={isBlocked(plan) ? 'bg-destructive/5' : undefined}>
                      <TableCell class="text-muted-foreground">{movement.date}</TableCell>
                      <TableCell class="max-w-40 truncate">{movement.description}</TableCell>
                      <TableCell>{previewKind(movement)}</TableCell>
                      <TableCell>{previewPayment(movement)}</TableCell>
                      <TableCell class="text-right font-mono">
                        {formatCurrency(movementTotal(movement))}
                      </TableCell>
                      <TableCell>{@render planAction(plan)}</TableCell>
                    </TableRow>
                  {/each}
                {/if}
                {#if preview.fullBackup && preview.movements.length > 50}
                  <TableRow>
                    <TableCell colspan={5} class="text-center text-muted-foreground">
                      ...and {preview.movements.length - 50} more
                    </TableCell>
                  </TableRow>
                {/if}
              </TableBody>
            </Table>
          </div>
          <div class="flex flex-wrap items-center justify-end gap-2">
            {#if unresolved > 0}
              <p class="mr-auto text-xs text-destructive">
                Choose how to handle each highlighted match.
              </p>
            {/if}
            <Button
              variant="outline"
              onclick={() => {
                preview = null
                error = null
              }}
            >
              Cancel
            </Button>
            <Button onclick={requestImport} disabled={unresolved > 0}>
              {unresolved > 0
                ? `Resolve ${unresolved} match${unresolved !== 1 ? 'es' : ''}`
                : 'Import'}
            </Button>
          </div>
        </div>
      {/if}
    </div>
  </DialogContent>
</Dialog>

<ConfirmDialog
  open={showConfirm}
  onOpenChange={(value) => {
    showConfirm = value
  }}
  title="Replace all data?"
  message="Importing a backup replaces every current movement and budget. This cannot be undone with Ctrl+Z."
  confirmLabel="Replace data"
  destructive
  onConfirm={handleImport}
/>
