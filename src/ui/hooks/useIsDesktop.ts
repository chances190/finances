import { useSyncExternalStore } from 'react'

const DESKTOP_QUERY = '(min-width: 640px)'

function subscribe(onStoreChange: () => void): () => void {
  const query = window.matchMedia(DESKTOP_QUERY)
  query.addEventListener('change', onStoreChange)
  return () => query.removeEventListener('change', onStoreChange)
}

function getSnapshot(): boolean {
  return window.matchMedia(DESKTOP_QUERY).matches
}

export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot)
}
