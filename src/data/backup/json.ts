import type { FinanceData } from '../../domain/entities'
import { downloadBlob } from '../download'
import type { LedgerValidationResult } from '../ledgerValidation'
import { normalizeFinanceData } from '../migration'

export function exportJSON(data: FinanceData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  downloadBlob(blob, `finances-${new Date().toISOString().slice(0, 10)}.json`)
}

export function importJSON(json: string): LedgerValidationResult {
  return normalizeFinanceData(JSON.parse(json))
}
