<script lang="ts">
import { onMount, untrack } from 'svelte'
import BudgetPage from '@/components/budgets/BudgetPage.svelte'
import AuditLogPanel from '@/components/common/AuditLogPanel.svelte'
import DashboardPage from '@/components/dashboard/DashboardPage.svelte'
import TrendsPage from '@/components/dashboard/TrendsPage.svelte'
import DebtPage from '@/components/debts/DebtPage.svelte'
import { finance } from '@/lib/stores/finance.svelte'
import { setResolvedThemeForLab } from '@/lib/stores/theme.svelte'
import { richFixture, stressFixture } from './fixture'
import LabShell from './LabShell.svelte'
import LabTransactions from './LabTransactions.svelte'
import { defaultSettings, type LabSettings } from './types'

let settings = $state<LabSettings>({ ...defaultSettings })
let mounted = $state(false)

const mirroredTokens = [
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--destructive',
  '--destructive-foreground',
  '--border',
  '--input',
  '--ring',
  '--radius',
  '--lab-accent',
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
  '--chart-6',
  '--chart-income',
  '--chart-expense',
  '--chart-budgeted',
  '--chart-grid',
]

$effect(() => {
  const themeMode = settings.theme
  const accent = settings.accent
  const stage = document.querySelector<HTMLElement>('.lab-stage')
  if (!stage) return
  const computed = getComputedStyle(stage)
  const root = document.documentElement
  root.classList.toggle('dark', themeMode === 'dark')
  root.dataset.labAccent = accent
  root.style.colorScheme = themeMode
  for (const token of mirroredTokens) {
    const value = computed.getPropertyValue(token).trim()
    if (value) root.style.setProperty(token, value)
  }
})

$effect(() => {
  const payload = settings.dataset === 'rich' ? richFixture : stressFixture()
  untrack(() => finance.dispatch({ type: 'LOAD', payload }))
})

$effect(() => {
  setResolvedThemeForLab(settings.theme)
  return () => setResolvedThemeForLab(null)
})

$effect(() => {
  if (!mounted) return
  window.parent.postMessage({ type: 'lab-screen', screen: settings.screen }, '*')
})

onMount(() => {
  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type !== 'lab-settings') return
    Object.assign(settings, event.data.settings)
  }
  window.addEventListener('message', handleMessage)
  window.parent.postMessage({ type: 'lab-ready' }, '*')
  mounted = true
  return () => window.removeEventListener('message', handleMessage)
})
</script>

<div
  class="lab-stage"
  class:dark={settings.theme === 'dark'}
  data-preset="glass"
  data-density={settings.density}
  data-accent={settings.accent}
>
  <LabShell bind:settings>
    {#if settings.screen === 'transactions'}
      <LabTransactions />
    {:else if settings.screen === 'budgets'}
      <BudgetPage />
    {:else if settings.screen === 'debts'}
      <DebtPage />
    {:else if settings.screen === 'dashboard'}
      <DashboardPage />
    {:else if settings.screen === 'trends'}
      <TrendsPage />
    {:else}
      <AuditLogPanel />
    {/if}
  </LabShell>
</div>
