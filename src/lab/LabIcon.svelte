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
import {
  IconChevronRight,
  IconFilter,
  IconHistory,
  IconLayoutDashboard,
  IconMenu2,
  IconMoon,
  IconPlus,
  IconReceipt,
  IconSearch,
  IconSettings,
  IconSun,
  IconTrendingUp,
  IconUsers,
  IconWallet,
} from '@tabler/icons-svelte'
import ChartPieIcon from 'phosphor-svelte/lib/ChartPieIcon'
import ClockIcon from 'phosphor-svelte/lib/ClockIcon'
import FunnelIcon from 'phosphor-svelte/lib/FunnelIcon'
import GearIcon from 'phosphor-svelte/lib/GearIcon'
import ListIcon from 'phosphor-svelte/lib/ListIcon'
import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon'
import MoonIcon from 'phosphor-svelte/lib/MoonIcon'
import PlusIcon from 'phosphor-svelte/lib/PlusIcon'
import ReceiptIcon from 'phosphor-svelte/lib/ReceiptIcon'
import SunIcon from 'phosphor-svelte/lib/SunIcon'
import TrendUpIcon from 'phosphor-svelte/lib/TrendUpIcon'
import UsersIcon from 'phosphor-svelte/lib/UsersIcon'
import WalletIcon from 'phosphor-svelte/lib/WalletIcon'
import type { IconName } from './types'

interface Props {
  pack: 'phosphor' | 'tabler' | 'hugeicons'
  name: IconName
  className?: string
}

let { pack, name, className = 'size-4' }: Props = $props()

const phosphor = {
  transactions: ReceiptIcon,
  budgets: WalletIcon,
  debts: UsersIcon,
  dashboard: ChartPieIcon,
  trends: TrendUpIcon,
  actions: ClockIcon,
  search: MagnifyingGlassIcon,
  filter: FunnelIcon,
  plus: PlusIcon,
  settings: GearIcon,
  sun: SunIcon,
  moon: MoonIcon,
  menu: ListIcon,
  arrow: ListIcon,
}

const tabler = {
  transactions: IconReceipt,
  budgets: IconWallet,
  debts: IconUsers,
  dashboard: IconLayoutDashboard,
  trends: IconTrendingUp,
  actions: IconHistory,
  search: IconSearch,
  filter: IconFilter,
  plus: IconPlus,
  settings: IconSettings,
  sun: IconSun,
  moon: IconMoon,
  menu: IconMenu2,
  arrow: IconChevronRight,
}

const hugeicons = {
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

{#if pack === 'hugeicons'}
  <HugeiconsIcon icon={hugeicons[name]} size={16} class={className} />
{:else if pack === 'tabler'}
  {@const Icon = tabler[name]}
  <Icon class={className} />
{:else}
  {@const Icon = phosphor[name]}
  <Icon class={className} />
{/if}
