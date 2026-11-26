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
