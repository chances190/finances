<script lang="ts">
import {
  Analytics01Icon,
  ArrowRight01Icon,
  DashboardSquare01Icon,
  FilterIcon,
  HistoryIcon,
  Menu01Icon,
  Moon02Icon,
  PlusSignIcon,
  ReceiptTextIcon,
  Search01Icon,
  Settings01Icon,
  Sun01Icon,
  UserGroupIcon,
  Wallet01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/svelte'
import type { IconName } from './types'

interface Props {
  name: IconName
  className?: string
}

let { name, className = 'size-4' }: Props = $props()

const icons = {
  transactions: ReceiptTextIcon,
  budgets: Wallet01Icon,
  debts: UserGroupIcon,
  dashboard: DashboardSquare01Icon,
  trends: Analytics01Icon,
  actions: HistoryIcon,
  search: Search01Icon,
  filter: FilterIcon,
  plus: PlusSignIcon,
  settings: Settings01Icon,
  sun: Sun01Icon,
  moon: Moon02Icon,
  menu: Menu01Icon,
  arrow: ArrowRight01Icon,
}
</script>

<HugeiconsIcon icon={icons[name]} size={16} class={className} />
