import type { FinanceData } from '../domain/entities'
import { validateFinanceData } from './validation'

const STORAGE_KEY = 'finances-data-v2'

export function loadData(): FinanceData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return validateFinanceData(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveData(data: FinanceData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, _version: 2 }))
}
