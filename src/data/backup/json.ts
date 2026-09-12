import type { FinanceData } from '../../domain/entities'
import { downloadBlob } from '../download'
import type { ValidationResult } from '../validation'
import { validateFinanceData } from '../validation'

export function exportJSON(data: FinanceData): void {
  const blob = new Blob([JSON.stringify({ ...data, _version: 2 }, null, 2)], {
    type: 'application/json',
  })
  downloadBlob(blob, `finances-${new Date().toISOString().slice(0, 10)}.json`)
}

export function importJSON(json: string): ValidationResult {
  return validateFinanceData(JSON.parse(json))
}
