<script lang="ts">
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { monthRelation } from '@/domain/calculations'
import FilterGroup from './FilterGroup.svelte'

interface Props {
  filterType: string
  filterMonth: string
  filterCategories: string[]
  filterPayments: string[]
  filterCounterparties: string[]
  months: string[]
  allCategories: string[]
  allPaymentMethods: string[]
  allCounterparties: string[]
  showOtherType: boolean
  updateParam: (key: string, value: string | string[] | null) => void
  wide?: boolean
}

let {
  filterType,
  filterMonth,
  filterCategories,
  filterPayments,
  filterCounterparties,
  months,
  allCategories,
  allPaymentMethods,
  allCounterparties,
  showOtherType,
  updateParam,
  wide = false,
}: Props = $props()
</script>

<Select type="single" value={filterType} onValueChange={(value) => updateParam('type', value)}>
  <SelectTrigger class={wide ? 'h-10 w-full text-xs sm:h-7' : 'h-7 w-24 text-xs'}>
    {filterType === 'all' ? 'All types' : filterType}
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All types</SelectItem>
    <SelectItem value="Expense">Expense</SelectItem>
    <SelectItem value="Income">Income</SelectItem>
    {#if showOtherType}
      <SelectItem value="Other">Transfers & payments</SelectItem>
    {/if}
  </SelectContent>
</Select>

<Select type="single" value={filterMonth} onValueChange={(value) => updateParam('month', value)}>
  <SelectTrigger class={wide ? 'h-10 w-full text-xs sm:h-7' : 'h-7 w-28 text-xs'}>
    {filterMonth === 'all' ? 'All months' : filterMonth}
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All months</SelectItem>
    {#each months as month (month)}
      {@const relation = monthRelation(month)}
      <SelectItem
        value={month}
        class={relation === 'future'
          ? 'text-muted-foreground/60'
          : relation === 'current'
            ? 'text-primary font-medium'
            : ''}
      >
        {month}
      </SelectItem>
    {/each}
  </SelectContent>
</Select>

<FilterGroup
  idPrefix="payment-filter"
  label="Payment"
  options={allPaymentMethods.map((method) => ({ value: method, label: method }))}
  selected={filterPayments}
  count={filterPayments.length}
  onToggle={(method, on) =>
    updateParam(
      'payment',
      on ? [...filterPayments, method] : filterPayments.filter((item) => item !== method),
    )}
  {wide}
/>

<FilterGroup
  idPrefix="cat-filter"
  label="Category"
  options={allCategories.map((category) => ({ value: category, label: category }))}
  selected={filterCategories}
  count={filterCategories.length}
  onToggle={(category, on) =>
    updateParam(
      'category',
      on ? [...filterCategories, category] : filterCategories.filter((item) => item !== category),
    )}
  {wide}
/>

{#if allCounterparties.length > 0}
  <FilterGroup
    idPrefix="person-filter"
    label="Person"
    options={allCounterparties.map((person) => ({ value: person, label: person }))}
    selected={filterCounterparties}
    count={filterCounterparties.length}
    onToggle={(person, on) =>
      updateParam(
        'person',
        on
          ? [...filterCounterparties, person]
          : filterCounterparties.filter((item) => item !== person),
      )}
    {wide}
  />
{/if}
