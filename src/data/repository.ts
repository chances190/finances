import type { FinanceData } from '../domain/entities'
import { validateFinanceData } from './validation'

const STORAGE_KEY = 'finances-data'

export function loadData(): FinanceData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? validateFinanceData(JSON.parse(raw)) : null
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
