import type { FinanceData } from '../domain/entities'
import { validateFinanceData } from './validation'

const STORAGE_KEY = 'finances-data'

export function loadData(): FinanceData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return validateFinanceData(JSON.parse(raw)).data
  } catch {
    return null
  }
}

export function saveData(data: FinanceData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}
