import { MediaQuery } from 'svelte/reactivity'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'
export type Accent = 'ink' | 'sage' | 'steel' | 'plum'
export type InkAccent =
  | 'mono'
  | 'system'
  | 'yellow'
  | 'green'
  | 'red'
  | 'pink'
  | 'blue'
  | 'purple'
  | 'orange'

interface AppearanceState {
  theme: ThemePreference
  accent: Accent
  inkAccent: InkAccent
}

const STORAGE_KEY = 'finances-theme'

const themes: ThemePreference[] = ['system', 'light', 'dark']
const accentOptions: Accent[] = ['ink', 'sage', 'steel', 'plum']
const inkAccentOptions: InkAccent[] = [
  'mono',
  'system',
  'yellow',
  'green',
  'red',
  'pink',
  'blue',
  'purple',
  'orange',
]

const defaults: AppearanceState = {
  theme: 'system',
  accent: 'ink',
  inkAccent: 'mono',
}

function read(): AppearanceState {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '')
    if (!raw || typeof raw !== 'object') return { ...defaults }
    return {
      theme: themes.includes(raw.theme) ? raw.theme : defaults.theme,
      accent: accentOptions.includes(raw.accent) ? raw.accent : defaults.accent,
      inkAccent: inkAccentOptions.includes(raw.inkAccent) ? raw.inkAccent : defaults.inkAccent,
    }
  } catch {
    return { ...defaults }
  }
}

let saved = $state<AppearanceState>(read())
let labPreview = $state<ResolvedTheme | null>(null)
const systemDark = new MediaQuery('(prefers-color-scheme: dark)')
const resolved: ResolvedTheme = $derived(
  labPreview ?? (saved.theme === 'system' ? (systemDark.current ? 'dark' : 'light') : saved.theme),
)

function write() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  } catch {}
}

function apply() {
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.dataset.accent = saved.accent
  root.dataset.inkAccent = saved.inkAccent
  root.style.colorScheme = resolved

  const background = getComputedStyle(root).getPropertyValue('--background').trim()
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', background || (resolved === 'dark' ? '#1e2427' : '#f0f2f3'))
  document
    .querySelector<HTMLLinkElement>('link[rel="icon"]')
    ?.setAttribute('href', resolved === 'dark' ? '/icon-dark.svg' : '/icon.svg')
}

export function setPreviewTheme(theme: ResolvedTheme | null) {
  labPreview = theme
}

let started = false

export function initAppearance(): () => void {
  if (started) return () => {}
  started = true
  const dispose = $effect.root(() => {
    $effect(() => {
      apply()
    })
  })
  return () => {
    dispose()
    started = false
  }
}

function setTheme(theme: ThemePreference) {
  saved.theme = theme
  write()
}

function setAccent(accent: Accent) {
  saved.accent = accent
  write()
}

function setInkAccent(inkAccent: InkAccent) {
  saved.inkAccent = inkAccent
  write()
}

export const appearance = {
  get theme() {
    return saved.theme
  },
  get accent() {
    return saved.accent
  },
  get inkAccent() {
    return saved.inkAccent
  },
  get resolved() {
    return resolved
  },
  setTheme,
  setAccent,
  setInkAccent,
}
