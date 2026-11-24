import { MediaQuery } from 'svelte/reactivity'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'finances-theme'

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {}
  return 'system'
}

let preference = $state<ThemePreference>(readPreference())
const systemDark = new MediaQuery('(prefers-color-scheme: dark)')
const resolved: ResolvedTheme = $derived(
  preference === 'system' ? (systemDark.current ? 'dark' : 'light') : preference,
)

let started = false

function apply(next: ResolvedTheme) {
  const root = document.documentElement
  root.classList.toggle('dark', next === 'dark')
  root.style.colorScheme = next
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', next === 'dark' ? '#262a32' : '#ffffff')
  document
    .querySelector<HTMLLinkElement>('link[rel="icon"]')
    ?.setAttribute('href', next === 'dark' ? '/icon-dark.svg' : '/icon.svg')
}

export function initTheme(): () => void {
  if (started) return () => {}
  started = true
  const dispose = $effect.root(() => {
    $effect(() => {
      apply(resolved)
    })
  })
  return () => {
    dispose()
    started = false
  }
}

function setPreference(next: ThemePreference) {
  preference = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {}
}

export const theme = {
  get preference() {
    return preference
  },
  get resolved() {
    return resolved
  },
  setPreference,
}
