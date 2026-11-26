<script lang="ts">
import type { Accent, LabScreen, LabSettings, LabTheme, LedgerVariant, Preset } from './types'

interface Props {
  settings: LabSettings
  onReset: () => void
}

let { settings, onReset }: Props = $props()

const presets: { value: Preset; label: string; hint: string; swatch: string }[] = [
  { value: 'warm', label: 'Warm Tactile', hint: 'bone + graphite', swatch: 'var(--preset-warm)' },
  { value: 'glass', label: 'Frosted Glass', hint: 'sage + blur', swatch: 'var(--preset-glass)' },
  { value: 'clay', label: 'Soft Clay', hint: 'terracotta', swatch: 'var(--preset-clay)' },
  {
    value: 'nordic',
    label: 'Nordic Mono',
    hint: 'taupe hairlines',
    swatch: 'var(--preset-nordic)',
  },
]

const ledgers: { value: LedgerVariant; label: string }[] = [
  { value: 'feed', label: 'Feed' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'table', label: 'Table' },
]

const accents: { value: Accent; label: string; color: string }[] = [
  { value: 'preset', label: 'Preset', color: 'var(--lab-accent)' },
  { value: 'ink', label: 'Ink', color: '#27241f' },
  { value: 'teal', label: 'Teal', color: '#3f7f78' },
  { value: 'plum', label: 'Plum', color: '#7b4a68' },
]

const viewports = [390, 768, 1280] as const

function set<K extends keyof LabSettings>(key: K, value: LabSettings[K]) {
  settings[key] = value
}
</script>

<div class="lab-toolbar">
  <div class="lab-toolbar-inner">
    <div class="lab-toolbar-brand">
      <span class="lab-toolbar-mark">dl</span>
      <div>
        <strong>Design lab</strong>
        <span>real components · synthetic data</span>
      </div>
    </div>

    <div class="lab-toolbar-group lab-preset-group">
      {#each presets as preset (preset.value)}
        <button
          type="button"
          class="lab-preset {settings.preset === preset.value ? 'is-active' : ''}"
          onclick={() => set('preset', preset.value)}
          title={preset.hint}
        >
          <span class="lab-swatch" style="background: {preset.swatch}"></span>
          {preset.label}
        </button>
      {/each}
    </div>

    <div class="lab-toolbar-row">
      <div class="lab-control">
        <span>Screen</span>
        <div class="lab-segment">
          {#each [
            ['transactions', 'Ledger'],
            ['dashboard', 'Dashboard'],
          ] as [value, label] (value)}
            <button
              type="button"
              class={settings.screen === value ? 'is-active' : ''}
              onclick={() => set('screen', value as LabScreen)}
            >
              {label}
            </button>
          {/each}
        </div>
      </div>

      <div class="lab-control">
        <span>Ledger</span>
        <div class="lab-segment">
          {#each ledgers as ledger (ledger.value)}
            <button
              type="button"
              class={settings.ledger === ledger.value ? 'is-active' : ''}
              onclick={() => set('ledger', ledger.value)}
            >
              {ledger.label}
            </button>
          {/each}
        </div>
      </div>

      <label class="lab-control">
        <span>Desktop nav</span>
        <select bind:value={settings.desktopNav}>
          {#each [
            ['top', 'Top tabs'],
            ['side', 'Sidebar'],
          ] as [value, label] (value)}
            <option {value}>{label}</option>
          {/each}
        </select>
      </label>

      <label class="lab-control">
        <span>Mobile nav</span>
        <select bind:value={settings.mobileNav}>
          {#each [
            ['bottom', 'Bottom bar'],
            ['sheet', 'Sheet'],
          ] as [value, label] (value)}
            <option {value}>{label}</option>
          {/each}
        </select>
      </label>

      <label class="lab-control">
        <span>Density</span>
        <select bind:value={settings.density}>
          {#each [
            ['comfortable', 'Comfortable'],
            ['compact', 'Compact'],
          ] as [value, label] (value)}
            <option {value}>{label}</option>
          {/each}
        </select>
      </label>

      <label class="lab-control">
        <span>Icons</span>
        <select bind:value={settings.iconPack}>
          {#each [
            ['phosphor', 'Phosphor'],
            ['tabler', 'Tabler'],
            ['hugeicons', 'Hugeicons'],
          ] as [value, label] (value)}
            <option {value}>{label}</option>
          {/each}
        </select>
      </label>

      <label class="lab-control">
        <span>Accent</span>
        <select bind:value={settings.accent}>
          {#each accents as accent (accent.value)}
            <option value={accent.value}>{accent.label}</option>
          {/each}
        </select>
      </label>

      <div class="lab-control">
        <span>Theme</span>
        <div class="lab-segment">
          {#each [
            ['light', 'Light'],
            ['dark', 'Dark'],
          ] as [value, label] (value)}
            <button
              type="button"
              class={settings.theme === value ? 'is-active' : ''}
              onclick={() => set('theme', value as LabTheme)}
            >
              {label}
            </button>
          {/each}
        </div>
      </div>

      <label class="lab-control">
        <span>Data</span>
        <select bind:value={settings.dataset}>
          {#each [
            ['rich', 'Rich fixture'],
            ['stress', '1,000 rows'],
          ] as [value, label] (value)}
            <option {value}>{label}</option>
          {/each}
        </select>
      </label>

      <div class="lab-control">
        <span>Viewport</span>
        <div class="lab-segment">
          {#each viewports as width (width)}
            <button
              type="button"
              class={settings.viewport === width ? 'is-active' : ''}
              onclick={() => set('viewport', width)}
            >
              {width}
            </button>
          {/each}
        </div>
      </div>

      <button type="button" class="lab-reset" onclick={onReset}>Reset</button>
    </div>
  </div>
</div>
