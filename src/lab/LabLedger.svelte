<script lang="ts">
import CarIcon from 'phosphor-svelte/lib/CarIcon'
import DevicesIcon from 'phosphor-svelte/lib/DevicesIcon'
import FilmStripIcon from 'phosphor-svelte/lib/FilmStripIcon'
import ForkKnifeIcon from 'phosphor-svelte/lib/ForkKnifeIcon'
import HeartbeatIcon from 'phosphor-svelte/lib/HeartbeatIcon'
import HouseIcon from 'phosphor-svelte/lib/HouseIcon'
import TagIcon from 'phosphor-svelte/lib/TagIcon'
import DebtStatusBadge from '@/components/transactions/DebtStatusBadge.svelte'
import {
  amountClass,
  amountOf,
  detailOf,
  kindLabelOf,
  paymentLabelOf,
} from '@/components/transactions/movement-display'
import PaymentBadge from '@/components/transactions/PaymentBadge.svelte'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  categoryOf,
  expenseAmount,
  installmentInfo,
  type Movement,
  monthRelation,
  movementMonth,
  type OutstandingMovement,
  outstandingMovements,
} from '@/domain/ledger'
import { formatCurrency } from '@/lib/currency'

interface Props {
  movements: Movement[]
  allMovements: Movement[]
  variant: 'feed' | 'hybrid' | 'table'
}

let { movements, allMovements, variant }: Props = $props()

const debtRowsById = $derived.by(() => {
  const map = new Map<string, OutstandingMovement[]>()
  for (const direction of ['receivable', 'payable'] as const) {
    for (const row of outstandingMovements(allMovements, direction)) {
      const rows = map.get(row.movementId)
      if (rows) rows.push(row)
      else map.set(row.movementId, [row])
    }
  }
  return map
})

const installmentsById = $derived.by(() => {
  const map = new Map<string, ReturnType<typeof installmentInfo>>()
  for (const movement of allMovements) map.set(movement.id, installmentInfo(movement, allMovements))
  return map
})

const groups = $derived.by(() => {
  const map = new Map<string, Movement[]>()
  for (const movement of [...movements].sort((a, b) => b.date.localeCompare(a.date))) {
    const rows = map.get(movement.date)
    if (rows) rows.push(movement)
    else map.set(movement.date, [movement])
  }
  return [...map.entries()].map(([date, items]) => ({ date, items }))
})

const categoryIcons: Record<string, typeof TagIcon> = {
  Food: ForkKnifeIcon,
  Fun: FilmStripIcon,
  Transport: CarIcon,
  Tech: DevicesIcon,
  Home: HouseIcon,
  Health: HeartbeatIcon,
}

function categoryIcon(category: string | undefined) {
  return (category && categoryIcons[category]) || TagIcon
}

function dateLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function isFuture(movement: Movement): boolean {
  return monthRelation(movementMonth(movement)) === 'future'
}

function displayAmount(movement: Movement): number {
  return movement.kind === 'purchase' ? expenseAmount(movement) : amountOf(movement)
}
</script>

{#if movements.length === 0}
  <div class="panel px-4 py-14 text-center">
    <p class="text-sm font-medium">No transactions match</p>
    <p class="mt-1 text-xs text-muted-foreground">Try a different filter or clear the search.</p>
  </div>
{:else if variant === 'feed'}
  <div class="lab-feed-groups">
    {#each groups as group (group.date)}
      <div class="lab-date-header">
        <span>{dateLabel(group.date)}</span>
        <span>{group.items.length} {group.items.length === 1 ? 'entry' : 'entries'}</span>
      </div>
      <div class="panel lab-ledger lab-feed divide-y divide-border overflow-hidden">
        {#each group.items as movement (movement.id)}
          {@const installment = installmentsById.get(movement.id)}
          {@const category = categoryOf(movement)}
          {@const Icon = categoryIcon(category)}
          <div class="lab-feed-row {isFuture(movement) ? 'opacity-50' : ''}">
            <div class="lab-feed-icon">
              <Icon class="size-4" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex min-w-0 items-center gap-1.5">
                <span class="truncate text-sm font-semibold">{movement.description}</span>
                {#if kindLabelOf(movement)}
                  <Badge variant="outline" class="shrink-0 text-[10px]"
                    >{kindLabelOf(movement)}</Badge
                  >
                {/if}
                <DebtStatusBadge rows={debtRowsById.get(movement.id) ?? []} />
              </div>
              <div class="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <span>{paymentLabelOf(movement)}</span>
                {#if category}
                  <span>·</span>
                  <span>{category}</span>
                {/if}
                {#if installment}
                  <span>·</span>
                  <span>{installment.index + 1}/{installment.total}</span>
                {/if}
              </div>
              {#if detailOf(movement, debtRowsById.get(movement.id) ?? [])}
                <p class="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {detailOf(movement, debtRowsById.get(movement.id) ?? [])}
                </p>
              {/if}
            </div>
            <div class="flex shrink-0 items-center gap-1.5">
              <span class="font-mono text-sm font-semibold {amountClass(movement)}">
                {movement.kind === 'income' ? '+' : ''}{formatCurrency(displayAmount(movement))}
              </span>
              <span class="text-muted-foreground/50">›</span>
            </div>
          </div>
        {/each}
      </div>
    {/each}
  </div>
{:else if variant === 'hybrid'}
  <div class="panel lab-ledger overflow-hidden">
    <div class="lab-hybrid-head">
      <span>Entry</span>
      <span>Amount</span>
    </div>
    {#each groups as group (group.date)}
      <div class="lab-hybrid-date">
        <span>{dateLabel(group.date)}</span>
        <span>{group.items.length} {group.items.length === 1 ? 'entry' : 'entries'}</span>
      </div>
      {#each group.items as movement (movement.id)}
        {@const installment = installmentsById.get(movement.id)}
        {@const category = categoryOf(movement)}
        <div class="lab-hybrid-row {isFuture(movement) ? 'opacity-50' : ''}">
          <div class="flex min-w-0 items-center gap-2.5">
            <span class="lab-dot {amountClass(movement)}"></span>
            <span class="truncate text-sm font-medium">{movement.description}</span>
            {#if kindLabelOf(movement)}
              <Badge variant="outline" class="shrink-0 text-[10px]">{kindLabelOf(movement)}</Badge>
            {/if}
            <DebtStatusBadge rows={debtRowsById.get(movement.id) ?? []} />
          </div>
          <div class="flex shrink-0 items-center gap-3">
            <span class="hidden text-[11px] text-muted-foreground sm:inline">
              {category ?? '—'}{installment
                ? ` · ${installment.index + 1}/${installment.total}`
                : ''}
            </span>
            <span class="font-mono text-sm font-semibold {amountClass(movement)}">
              {movement.kind === 'income' ? '+' : ''}{formatCurrency(displayAmount(movement))}
            </span>
            <span class="w-3 text-muted-foreground/50">›</span>
          </div>
        </div>
      {/each}
    {/each}
  </div>
{:else}
  <div class="panel lab-ledger overflow-hidden">
    <Table class="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead class="w-32">Payment</TableHead>
          <TableHead class="w-28 text-right">Amount</TableHead>
          <TableHead>Description</TableHead>
          <TableHead class="w-24">Category</TableHead>
          <TableHead class="w-24">Date</TableHead>
          <TableHead class="w-20 text-center">Inst.</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each movements as movement (movement.id)}
          {@const installment = installmentsById.get(movement.id)}
          <TableRow class={isFuture(movement) ? 'opacity-50' : ''}>
            <TableCell><PaymentBadge {movement} /></TableCell>
            <TableCell class="text-right font-mono text-xs {amountClass(movement)}">
              {formatCurrency(displayAmount(movement))}
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-1.5">
                <span class="truncate">{movement.description}</span>
                {#if kindLabelOf(movement)}
                  <Badge variant="outline" class="shrink-0 text-[10px]"
                    >{kindLabelOf(movement)}</Badge
                  >
                {/if}
                <DebtStatusBadge rows={debtRowsById.get(movement.id) ?? []} />
              </div>
              {#if detailOf(movement, debtRowsById.get(movement.id) ?? [])}
                <div class="truncate text-[10px] text-muted-foreground">
                  {detailOf(movement, debtRowsById.get(movement.id) ?? [])}
                </div>
              {/if}
            </TableCell>
            <TableCell class="text-xs">{categoryOf(movement) ?? '—'}</TableCell>
            <TableCell class="text-xs">{movement.date}</TableCell>
            <TableCell class="text-center text-xs">
              {installment ? `${installment.index + 1}/${installment.total}` : '—'}
            </TableCell>
          </TableRow>
        {/each}
      </TableBody>
    </Table>
  </div>
{/if}
