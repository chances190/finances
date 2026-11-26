<script lang="ts">
import {
  Analytics01Icon,
  DashboardSquare01Icon,
  HistoryIcon,
  ReceiptTextIcon,
  Settings01Icon,
  UserGroupIcon,
  Wallet01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/svelte'
import type { NavIconName } from './nav'

interface Props {
  name: NavIconName
  class?: string
}

let { name, class: className = 'size-4' }: Props = $props()

const icons = {
  transactions: ReceiptTextIcon,
  budgets: Wallet01Icon,
  debts: UserGroupIcon,
  dashboard: DashboardSquare01Icon,
  trends: Analytics01Icon,
  history: HistoryIcon,
  settings: Settings01Icon,
}
</script>

<HugeiconsIcon icon={icons[name]} size={16} class={className} />
