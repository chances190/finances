<script lang="ts">
import { untrack } from 'svelte'
import { finance } from '@/lib/stores/finance.svelte'
import { richFixture, stressFixture } from './fixture'
import IconGallery from './IconGallery.svelte'
import LabDashboard from './LabDashboard.svelte'
import LabShell from './LabShell.svelte'
import LabToolbar from './LabToolbar.svelte'
import LabTransactions from './LabTransactions.svelte'
import { defaultSettings, type LabSettings } from './types'

let settings = $state<LabSettings>({ ...defaultSettings })

$effect(() => {
  const payload = settings.dataset === 'rich' ? richFixture : stressFixture()
  untrack(() => finance.dispatch({ type: 'LOAD', payload }))
})

function reset() {
  Object.assign(settings, defaultSettings)
}
</script>

<LabToolbar {settings} onReset={reset} />

<div class="lab-stage-wrap">
  <div
    class="lab-stage"
    class:dark={settings.theme === 'dark'}
    data-preset={settings.preset}
    data-density={settings.density}
    data-accent={settings.accent}
    data-mobile-nav={settings.mobileNav}
    style="width: {settings.viewport}px"
  >
    <LabShell {settings}>
      {#if settings.screen === 'transactions'}
        <LabTransactions iconPack={settings.iconPack} ledgerVariant={settings.ledger} />
      {:else}
        <LabDashboard iconPack={settings.iconPack} />
      {/if}
      <div class="mt-5">
        <IconGallery selected={settings.iconPack} />
      </div>
    </LabShell>
  </div>
</div>

<p class="lab-footnote">
  Dev-only lab · synthetic data · production styles and components untouched
</p>
