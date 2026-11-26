<script lang="ts">
import { onMount } from 'svelte'
import BudgetPage from '@/components/budgets/BudgetPage.svelte'
import AuditLogPanel from '@/components/common/AuditLogPanel.svelte'
import DashboardPage from '@/components/dashboard/DashboardPage.svelte'
import TrendsPage from '@/components/dashboard/TrendsPage.svelte'
import DebtPage from '@/components/debts/DebtPage.svelte'
import SettingsPage from '@/components/settings/SettingsPage.svelte'
import BrandMark from '@/components/shell/BrandMark.svelte'
import MobileNav from '@/components/shell/MobileNav.svelte'
import NavIcon from '@/components/shell/NavIcon.svelte'
import { navItems } from '@/components/shell/nav'
import SyncControl from '@/components/shell/SyncControl.svelte'
import Toasts from '@/components/shell/Toasts.svelte'
import TransactionsPage from '@/components/transactions/TransactionsPage.svelte'
import { initRouter, navigate, router } from '@/lib/router.svelte'
import { initAppearance } from '@/lib/stores/appearance.svelte'
import { finance, flushFinance, loadFinance } from '@/lib/stores/finance.svelte'
import { toast } from '@/lib/stores/toast.svelte'
import { initViewport } from '@/lib/viewport'

const monthLabel = new Date().toLocaleDateString('en-GB', {
  month: 'long',
  year: 'numeric',
})

const activePath = $derived(
  navItems.find((item) => item.path === router.path)?.path ?? navItems[0].path,
)
const stopAppearance = initAppearance()

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
  const stopViewport = initViewport()
  window.addEventListener('pagehide', flushFinance)
  return () => {
    disposeRouter()
    stopViewport()
    stopAppearance()
    window.removeEventListener('pagehide', flushFinance)
  }
})
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="min-h-dvh">
  <header class="app-header sticky top-0 z-40 border-b border-border pt-[env(safe-area-inset-top)]">
    <div
      class="mx-auto flex max-w-7xl items-center justify-between gap-3.5 px-4 py-3 max-md:gap-3 max-md:px-3 max-md:py-2.5"
    >
      <a
        href="/"
        class="flex min-w-0 items-center gap-2.5"
        onclick={(event) => {
          event.preventDefault()
          navigate('/')
        }}
      >
        <BrandMark class="size-8 shrink-0" />
        <span class="min-w-0">
          <span class="flex items-center gap-2">
            <span class="brand-name">Finances</span>
            <span class="brand-tag">Glass + Clay</span>
          </span>
          <span class="brand-sub hidden md:block">{monthLabel} · personal ledger</span>
        </span>
      </a>

      <nav class="hidden items-center gap-0.5 lg:flex" aria-label="Main">
        {#each navItems as item (item.path)}
          <button
            type="button"
            aria-current={activePath === item.path ? 'page' : undefined}
            class="nav-item"
            class:is-active={activePath === item.path}
            onclick={() => navigate(item.path)}
          >
            <NavIcon name={item.icon} />
            {item.label}
          </button>
        {/each}
      </nav>

      <div class="flex items-center gap-1">
        <SyncControl />
        <MobileNav items={navItems} active={activePath} onChange={navigate} />
      </div>
    </div>
  </header>

  <main class="mx-auto max-w-7xl px-4 py-4 max-sm:px-3 max-sm:py-3">
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
        <AuditLogPanel />
      {:else if router.path === '/settings'}
        <SettingsPage />
      {:else}
        <TransactionsPage />
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
