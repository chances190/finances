<script lang="ts">
import { onMount } from 'svelte'
import BudgetPage from '@/components/budgets/BudgetPage.svelte'
import DashboardPage from '@/components/dashboard/DashboardPage.svelte'
import TrendsPage from '@/components/dashboard/TrendsPage.svelte'
import DebtPage from '@/components/debts/DebtPage.svelte'
import MobileNav from '@/components/shell/MobileNav.svelte'
import PageStub from '@/components/shell/PageStub.svelte'
import Tabs from '@/components/shell/Tabs.svelte'
import Toasts from '@/components/shell/Toasts.svelte'
import TransactionTable from '@/components/transactions/TransactionTable.svelte'
import { initRouter, navigate, router } from '@/lib/router.svelte'
import { finance, flushFinance, loadFinance } from '@/lib/stores/finance.svelte'
import { toast } from '@/lib/stores/toast.svelte'

const tabs = [
  { key: '/', label: 'Transactions' },
  { key: '/budgets', label: 'Budgets' },
  { key: '/debts', label: 'Debts' },
  { key: '/dashboard', label: 'Dashboard' },
  { key: '/yearly', label: 'Trends' },
  { key: '/history', label: 'Actions' },
]

const activeTab = $derived(tabs.find((tab) => tab.key === router.path)?.key ?? '/')

function handleKeydown(event: KeyboardEvent) {
  if (!(event.ctrlKey || event.metaKey)) return
  const target = event.target
  const isTextEntry =
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable)
  const isInteractiveControl =
    target instanceof HTMLElement &&
    target.closest(
      'button, a, [role="button"], [role="checkbox"], [role="combobox"], [role="switch"]',
    )
  if (isTextEntry || isInteractiveControl) return

  if (event.key === 'z' && !event.shiftKey) {
    event.preventDefault()
    const latest = finance.state.auditLog[0]
    if (latest) {
      finance.dispatch({ type: 'UNDO', payload: latest.id })
      toast(`Undo: ${latest.description}`, 'info')
    }
  }
  if (event.key === 'y' || (event.key === 'z' && event.shiftKey)) {
    event.preventDefault()
    if (finance.state.redoStack.length > 0) {
      finance.dispatch({ type: 'REDO' })
      toast('Redo', 'info')
    }
  }
}

onMount(() => {
  loadFinance()
  const disposeRouter = initRouter()
  window.addEventListener('pagehide', flushFinance)
  return () => {
    disposeRouter()
    window.removeEventListener('pagehide', flushFinance)
  }
})
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="min-h-screen bg-background">
  <header class="sticky top-0 z-40 border-b border-border bg-card pt-[env(safe-area-inset-top)]">
    <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
      <h1 class="flex items-center gap-2 text-base font-heading font-bold">
        <img src="/icon.svg" alt="" class="size-5">
        Finances
      </h1>
      <div class="flex items-center gap-1">
        <MobileNav {tabs} active={activeTab} onChange={navigate} />
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 py-6">
    <div class="hidden sm:block">
      <Tabs {tabs} active={activeTab} onChange={navigate} />
    </div>

    <svelte:boundary onerror={(error) => console.error(error)}>
      {#if router.path === '/budgets'}
        <BudgetPage />
      {:else if router.path === '/debts'}
        <DebtPage />
      {:else if router.path === '/dashboard'}
        <DashboardPage />
      {:else if router.path === '/yearly'}
        <TrendsPage />
      {:else if router.path === '/history'}
        <PageStub title="Actions" />
      {:else}
        <TransactionTable />
      {/if}

      {#snippet failed(_error, reset)}
        <div
          class="flex min-h-64 flex-col items-center justify-center gap-3 text-sm text-muted-foreground"
        >
          <p>Something went wrong.</p>
          <button type="button" class="underline hover:text-foreground" onclick={reset}>
            Try again
          </button>
        </div>
      {/snippet}
    </svelte:boundary>
  </main>

  <Toasts />
</div>
