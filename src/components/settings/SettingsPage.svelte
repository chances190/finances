<script lang="ts">
import DataSettings from '@/components/common/DataSettings.svelte'
import { SegmentedControl } from '@/components/ui/segmented-control'
import {
  type Accent,
  appearance,
  type InkAccent,
  type ThemePreference,
} from '@/lib/stores/appearance.svelte'
import { cn } from '@/lib/utils'

interface BaseOption {
  value: Accent
  label: string
  light: string
  dark: string
}

const bases: BaseOption[] = [
  { value: 'ink', label: 'Ink', light: '#262b30', dark: '#e6ecef' },
  { value: 'sage', label: 'Sage', light: '#2f6f68', dark: '#95d6c7' },
  { value: 'steel', label: 'Steel', light: '#5f7f93', dark: '#9cc0d4' },
  { value: 'plum', label: 'Plum', light: '#7b4a68', dark: '#c79ab9' },
]

interface InkOption {
  value: InkAccent
  label: string
  light: string
  dark: string
  swatch?: string
}

const inkAccents: InkOption[] = [
  {
    value: 'mono',
    label: 'Black / White',
    light: '#262b30',
    dark: '#e6ecef',
    swatch: 'linear-gradient(135deg, #1b1b1f 50%, #f4f4f5 50%)',
  },
  {
    value: 'system',
    label: 'System',
    light: '#2f6f68',
    dark: '#95d6c7',
    swatch:
      'conic-gradient(from 0deg, #e8c25a, #7ddba0, #9dbdf0, #c3a6f0, #f0a6c8, #f09a9a, #f0b07a, #e8c25a)',
  },
  { value: 'yellow', label: 'Yellow', light: '#8a6508', dark: '#e8c25a' },
  { value: 'green', label: 'Green', light: '#2f6f4a', dark: '#7ddba0' },
  { value: 'red', label: 'Red', light: '#a33434', dark: '#f09a9a' },
  { value: 'pink', label: 'Pink', light: '#a33a72', dark: '#f0a6c8' },
  { value: 'blue', label: 'Blue', light: '#3a5f9e', dark: '#9dbdf0' },
  { value: 'purple', label: 'Purple', light: '#6a47a3', dark: '#c3a6f0' },
  { value: 'orange', label: 'Orange', light: '#9e5326', dark: '#f0b07a' },
]

const dark = $derived(appearance.resolved === 'dark')

function setTheme(value: string) {
  appearance.setTheme(value as ThemePreference)
}

function setBase(value: Accent) {
  appearance.setAccent(value)
}

function setInk(value: InkAccent) {
  appearance.setInkAccent(value)
}
</script>

<div class="space-y-4">
  <div>
    <h2 class="text-lg font-semibold text-foreground">Settings</h2>
    <p class="text-xs text-muted-foreground">Appearance and data</p>
  </div>

  <section class="panel space-y-5 p-4 sm:p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="text-sm font-semibold text-foreground">Theme</h3>
        <p class="text-xs text-muted-foreground">Glass in the dark, clay in the light.</p>
      </div>
      <SegmentedControl
        aria-label="Theme"
        value={appearance.theme}
        options={[
          { value: 'system', label: 'System' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
        onValueChange={setTheme}
      />
    </div>

    <div class="space-y-2.5">
      <div>
        <h3 class="text-sm font-semibold text-foreground">Base colour</h3>
        <p class="text-xs text-muted-foreground">The surface family for the whole app.</p>
      </div>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {#each bases as base (base.value)}
          {@const selected = appearance.accent === base.value}
          <button
            type="button"
            aria-pressed={selected}
            onclick={() => setBase(base.value)}
            class={cn(
              'flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-left transition-colors',
              selected ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-muted',
            )}
          >
            <span
              class="size-5 shrink-0 rounded-full ring-1 ring-black/10 ring-inset dark:ring-white/20"
              style:background={dark ? base.dark : base.light}
            ></span>
            <span class="text-xs font-semibold text-foreground">{base.label}</span>
          </button>
        {/each}
      </div>
    </div>

    {#if appearance.accent === 'ink'}
      <div class="space-y-2.5 border-t border-border pt-5">
        <div>
          <h3 class="text-sm font-semibold text-foreground">Accent colour</h3>
          <p class="text-xs text-muted-foreground">Highlights for the neutral Ink surface.</p>
        </div>
        <div class="flex flex-wrap gap-1.5">
          {#each inkAccents as accent (accent.value)}
            {@const selected = appearance.inkAccent === accent.value}
            <button
              type="button"
              aria-pressed={selected}
              aria-label={accent.label}
              onclick={() => setInk(accent.value)}
              class={cn(
                'flex w-[70px] flex-col items-center gap-1.5 rounded-md border px-1.5 py-2 transition-colors',
                selected ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-muted',
              )}
            >
              <span
                class="size-6 rounded-full ring-1 ring-black/15 ring-inset dark:ring-white/25"
                style:background={accent.swatch ?? (dark ? accent.dark : accent.light)}
              ></span>
              <span class="text-[11px] leading-tight text-foreground">{accent.label}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </section>

  <section class="panel space-y-3 p-4 sm:p-5">
    <div>
      <h3 class="text-sm font-semibold text-foreground">Data</h3>
      <p class="text-xs text-muted-foreground">Back up or restore your ledger.</p>
    </div>
    <DataSettings />
  </section>
</div>
