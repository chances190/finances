<script lang="ts">
import { untrack } from 'svelte'
import { Button } from '@/components/ui/button'
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
import {
  accountForPaymentMethod,
  buildRefund,
  EXPENSE_PAYMENT_METHODS,
  localYMD,
  type Movement,
  type PaymentMethod,
  paymentMethodOf,
  refundableAmount,
} from '@/domain/ledger'
import { formatCurrency, parseCurrency } from '@/lib/currency'
import { finance } from '@/lib/stores/finance.svelte'
import { toast } from '@/lib/stores/toast.svelte'

interface Props {
  purchase: Movement
  onOpenChange: (open: boolean) => void
}

let { purchase, onOpenChange }: Props = $props()

const original = untrack(() => paymentMethodOf(purchase))

let amount = $state('')
let method = $state<PaymentMethod>(original && original !== 'Someone else' ? original : 'Debit/PIX')
let date = $state(localYMD())
let description = $state(untrack(() => purchase.description))

const available = $derived(refundableAmount(purchase, finance.state.movements))

function handleSave() {
  const result = buildRefund({
    id: crypto.randomUUID(),
    date,
    description,
    amount: parseCurrency(amount),
    account: accountForPaymentMethod(method),
    purchase,
    existing: finance.state.movements,
  })
  if (!result.ok) {
    toast(result.reason, 'error')
    return
  }
  finance.dispatch({ type: 'ADD_MOVEMENTS', payload: [result.value] })
  toast('Reimbursement recorded', 'success')
  onOpenChange(false)
}
</script>

<Dialog open {onOpenChange}>
  <DialogContent class="sm:max-w-sm">
    <DialogHeader>
      <DialogTitle>Reimbursed</DialogTitle>
      <DialogDescription>
        Net this amount against “{purchase.description}”. Up to {formatCurrency(available)} remains.
      </DialogDescription>
    </DialogHeader>
    <div class="space-y-3">
      <div class="space-y-1">
        <Label for="refund-amount" class="text-xs">Amount (R$)</Label>
        <MoneyInput
          id="refund-amount"
          value={amount}
          onValueChange={(next) => {
            amount = next
          }}
        />
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <Label for="refund-date" class="text-xs">Date</Label>
          <Input
            id="refund-date"
            type="date"
            value={date}
            oninput={(event) => {
              date = event.currentTarget.value
            }}
          />
        </div>
        <div class="space-y-1">
          <Label for="refund-account" class="text-xs">Received via</Label>
          <Select
            type="single"
            value={method}
            onValueChange={(value) => {
              method = (value ?? 'Credit') as PaymentMethod
            }}
          >
            <SelectTrigger id="refund-account" class="w-full">
              {method}
            </SelectTrigger>
            <SelectContent>
              {#each EXPENSE_PAYMENT_METHODS as option (option)}
                <SelectItem value={option}>{option}</SelectItem>
              {/each}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div class="space-y-1">
        <Label for="refund-description" class="text-xs">Description</Label>
        <Input
          id="refund-description"
          value={description}
          oninput={(event) => {
            description = event.currentTarget.value
          }}
        />
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onclick={() => onOpenChange(false)}>Cancel</Button>
      <Button onclick={handleSave} disabled={available <= 0}>Record</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
