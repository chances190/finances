import type { FinanceData } from '../domain/entities'

const STORAGE_KEY = 'finances-data'

export function loadData(): FinanceData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as FinanceData) : null
  } catch {
    return null
  }
}

export function saveData(data: FinanceData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function clearData(): void {
  localStorage.removeItem(STORAGE_KEY)
}
