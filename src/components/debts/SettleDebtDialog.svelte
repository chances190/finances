<script lang="ts">
import { untrack } from 'svelte'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoneyInput } from '@/components/ui/money-input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { buildSettlement, localYMD } from '@/domain/ledger'
import { addCurrency, formatCurrency, formatPlainCurrency, parseCurrency } from '@/lib/currency'
import { finance } from '@/lib/stores/finance.svelte'
import { toast } from '@/lib/stores/toast.svelte'
import { toastUndo } from '@/lib/undo-toast'
import type { SettleTarget } from './debt-helpers'

interface Props {
  target: SettleTarget
  onOpenChange: (open: boolean) => void
}

let { target, onOpenChange }: Props = $props()

const rows = untrack(() => target.rows)
const direction = rows[0]?.direction
const counterparty = rows[0]?.counterparty
const owed = rows.reduce((sum, row) => addCurrency(sum, row.outstanding), 0)
const description = rows.length === 1 ? rows[0].description : undefined

let cash = $state(formatPlainCurrency(owed))
let method = $state<'Transfer' | 'Cash'>('Transfer')
let date = $state(localYMD())
let forgiveRest = $state(false)

const received = $derived(parseCurrency(cash))
const remainder = $derived(addCurrency(owed, -received))

function handleSave() {
  if (!direction || !counterparty) return
  const cleared = forgiveRest || received > owed + 0.004 ? owed : received
  const settlement = buildSettlement(
    {
      id: crypto.randomUUID(),
      date,
      description: `Settled with ${counterparty}`,
      direction,
      counterparty,
      cash: received,
      cleared,
      account: method === 'Cash' ? 'cash' : 'checking',
      links: rows.map((row) => row.movementId),
    },
    finance.state.movements,
  )

  if (!settlement.ok) {
    toast(settlement.reason, 'error')
    return
  }
  const auditId = finance.dispatchUndoable({ type: 'ADD_MOVEMENTS', payload: [settlement.value] })
  toastUndo('Settlement recorded', auditId)
  onOpenChange(false)
}
</script>

<Dialog open {onOpenChange}>
  <DialogContent class="sm:max-w-sm">
    <DialogHeader>
      <DialogTitle>Settle debt</DialogTitle>
      <DialogDescription>
        {#if counterparty}
          {counterparty} · {formatCurrency(owed)} outstanding{description
            ? ` on “${description}”`
            : ''}
        {/if}
      </DialogDescription>
    </DialogHeader>

    <div class="space-y-3">
      <div class="space-y-1">
        <Label for="settle-cash" class="text-xs">
          {direction === 'receivable' ? 'Received (R$)' : 'Paid (R$)'}
        </Label>
        <MoneyInput
          id="settle-cash"
          value={cash}
          onValueChange={(next) => {
            cash = next
          }}
        />
        <p class="text-[11px] text-muted-foreground">
          {#if remainder < -0.004}
            {formatCurrency(-remainder)} overpaid
          {:else if remainder <= 0.004}
            Settles the full amount
          {:else if forgiveRest}
            {formatCurrency(remainder)} forgiven
          {:else}
            {formatCurrency(remainder)} still owed
          {/if}
        </p>
        {#if remainder > 0.004}
          <label
            for="settle-forgive"
            class="flex min-h-10 cursor-pointer items-center gap-2 text-xs text-muted-foreground"
          >
            <Checkbox
              id="settle-forgive"
              checked={forgiveRest}
              onCheckedChange={(checked) => {
                forgiveRest = checked === true
              }}
            />
            <span>Forgive the rest</span>
          </label>
        {/if}
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <Label for="settle-date" class="text-xs">Date</Label>
          <Input
            id="settle-date"
            type="date"
            value={date}
            oninput={(event) => {
              date = event.currentTarget.value
            }}
          />
        </div>
        <div class="space-y-1">
          <Label for="settle-method" class="text-xs">Payment method</Label>
          <Select
            type="single"
            value={method}
            onValueChange={(value) => {
              method = value === 'Cash' ? 'Cash' : 'Transfer'
            }}
          >
            <SelectTrigger id="settle-method" class="w-full">
              {method}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Transfer">Transfer</SelectItem>
              <SelectItem value="Cash">Cash</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>

    <DialogFooter>
      <Button variant="outline" onclick={() => onOpenChange(false)}>Cancel</Button>
      <Button onclick={handleSave} disabled={received <= 0.004 && !forgiveRest}>Record</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
