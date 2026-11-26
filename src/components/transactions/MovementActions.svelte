<script lang="ts">
import ArrowDownLeftIcon from 'phosphor-svelte/lib/ArrowDownLeftIcon'
import DotsThreeIcon from 'phosphor-svelte/lib/DotsThreeIcon'
import HandCoinsIcon from 'phosphor-svelte/lib/HandCoinsIcon'
import TrashIcon from 'phosphor-svelte/lib/TrashIcon'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Movement } from '@/domain/ledger'
import { navigate } from '@/lib/router.svelte'

interface Props {
  movement: Movement
  label?: string
  onRefund: (movement: Movement) => void
  onDelete: (id: string) => void
}

let { movement, label = 'Transaction actions', onRefund, onDelete }: Props = $props()
let open = $state(false)

const hasDebt = $derived(
  movement.kind === 'purchase' &&
    movement.postings.some(
      (posting) => posting.account === 'receivable' || posting.account === 'payable',
    ),
)

function act(action: () => void) {
  open = false
  action()
}

function goToDebt() {
  open = false
  navigate(`/debts?movement=${movement.id}&settled=1`)
}
</script>

<Popover bind:open>
  <PopoverTrigger>
    {#snippet child({ props })}
      <Button variant="ghost" size="icon" class="size-10 shrink-0" aria-label={label} {...props}>
        <DotsThreeIcon class="size-4" />
      </Button>
    {/snippet}
  </PopoverTrigger>
  <PopoverContent align="end" class="w-44 p-1">
    {#if hasDebt}
      <a
        href={`/debts?movement=${movement.id}&settled=1`}
        class="flex w-full items-center gap-2 px-2 py-2 text-left text-xs hover:bg-muted"
        onclick={(event) => {
          event.preventDefault()
          goToDebt()
        }}
      >
        <HandCoinsIcon class="size-4" /> Go to debt
      </a>
    {/if}
    {#if movement.kind === 'purchase'}
      <button
        type="button"
        class="flex w-full items-center gap-2 px-2 py-2 text-left text-xs hover:bg-muted"
        onclick={() => act(() => onRefund(movement))}
      >
        <ArrowDownLeftIcon class="size-4" /> Reimbursed
      </button>
    {/if}
    <button
      type="button"
      class="flex w-full items-center gap-2 px-2 py-2 text-left text-xs text-destructive hover:bg-destructive/10"
      onclick={() => act(() => onDelete(movement.id))}
    >
      <TrashIcon class="size-4" /> Delete
    </button>
  </PopoverContent>
</Popover>
