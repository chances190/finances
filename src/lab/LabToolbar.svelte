<script lang="ts">
import type { Accent, LabSettings, LabTheme } from './types'

interface Props {
  settings: LabSettings
  onReset: () => void
}

let { settings = $bindable(), onReset }: Props = $props()

const accents: { value: Accent; label: string; color: string }[] = [
  { value: 'preset', label: 'Preset', color: 'var(--lab-accent)' },
  { value: 'ink', label: 'Ink', color: '#262b30' },
  { value: 'sage', label: 'Sage', color: '#748f82' },
  { value: 'steel', label: 'Steel', color: '#5f7f93' },
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
        <strong>Design lab · round 2</strong>
      </div>
    </div>

    <div class="lab-toolbar-row">
      <label class="lab-control">
        <span>Desktop nav · open</span>
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
