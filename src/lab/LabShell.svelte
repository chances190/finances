<script lang="ts">
import type { Snippet } from 'svelte'
import LabIcon from './LabIcon.svelte'
import type { IconName, LabScreen, LabSettings } from './types'

interface Props {
  settings: LabSettings
  children: Snippet
}

let { settings = $bindable(), children }: Props = $props()

const items: {
  key: LabScreen | 'budgets' | 'debts' | 'trends' | 'actions'
  label: string
  icon: IconName
}[] = [
  { key: 'transactions', label: 'Transactions', icon: 'transactions' },
  { key: 'budgets', label: 'Budgets', icon: 'budgets' },
  { key: 'debts', label: 'Debts', icon: 'debts' },
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'trends', label: 'Trends', icon: 'trends' },
  { key: 'actions', label: 'Actions', icon: 'actions' },
]

let sheetOpen = $state(false)

function select(key: (typeof items)[number]['key']) {
  if (key === 'transactions' || key === 'dashboard') settings.screen = key
  sheetOpen = false
}
</script>

{#snippet nav(vertical: boolean)}
  <nav class={vertical ? 'lab-nav lab-nav-vertical' : 'lab-nav'}>
    {#each items as item (item.key)}
      <button
        type="button"
        class="lab-nav-item {settings.screen === item.key ? 'is-active' : ''}"
        onclick={() => select(item.key)}
      >
        <LabIcon pack={settings.iconPack} name={item.icon} className="size-4" />
        <span>{item.label}</span>
      </button>
    {/each}
  </nav>
{/snippet}

<div class="lab-app">
  <header class="lab-header">
    <div class="flex min-w-0 items-center gap-2.5">
      <img src={settings.theme === 'dark' ? '/icon-dark.svg' : '/icon.svg'} alt="" class="size-8">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="lab-brand-name">Finances</span>
          <span class="lab-brand-tag">{settings.preset}</span>
        </div>
        <p class="lab-brand-sub">November 2026 · personal ledger</p>
      </div>
    </div>

    {#if settings.desktopNav === 'top'}
      <div class="lab-desktop-nav">
        {@render nav(false)}
      </div>
    {/if}

    <div class="lab-header-actions">
      <button
        type="button"
        class="lab-icon-button lab-mobile-only"
        aria-label="Open navigation"
        onclick={() => {
          sheetOpen = !sheetOpen
        }}
      >
        <LabIcon pack={settings.iconPack} name="menu" className="size-4" />
      </button>
      <button type="button" class="lab-icon-button" aria-label="Settings">
        <LabIcon pack={settings.iconPack} name="settings" className="size-4" />
      </button>
    </div>
  </header>

  {#if sheetOpen}
    <div class="lab-sheet">
      <div class="lab-sheet-head">
        <span>Navigate</span>
        <button type="button" onclick={() => (sheetOpen = false)} aria-label="Close navigation">
          ×
        </button>
      </div>
      {@render nav(true)}
    </div>
  {/if}

  <div class="lab-body">
    {#if settings.desktopNav === 'side'}
      <aside class="lab-sidebar">
        {@render nav(true)}
      </aside>
    {/if}
    <main class="lab-main">
      {@render children()}
    </main>
  </div>

  {#if settings.mobileNav === 'bottom'}
    <nav class="lab-bottom-nav">
      {#each items.slice(0, 4) as item (item.key)}
        <button
          type="button"
          class="lab-bottom-item {settings.screen === item.key ? 'is-active' : ''}"
          onclick={() => select(item.key)}
        >
          <LabIcon pack={settings.iconPack} name={item.icon} className="size-4" />
          <span>{item.label}</span>
        </button>
      {/each}
      <button type="button" class="lab-bottom-item" onclick={() => (sheetOpen = true)}>
        <LabIcon pack={settings.iconPack} name="menu" className="size-4" />
        <span>More</span>
      </button>
    </nav>
  {/if}
</div>
