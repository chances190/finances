import type { FinanceData, Transaction } from '../domain/entities'
import {
  addMonthsToDate,
  buildIncome,
  buildPurchase,
  buildSettlement,
  type LedgerData,
  type Movement,
} from '../domain/ledger'
import { type LedgerValidationResult, validateLedgerData } from './ledgerValidation'
import { validateFinanceData } from './validation'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function migrateTransaction(
  transaction: Transaction,
  index: number,
  movements: Movement[],
  skipped: { index: number; reason: string }[],
): void {
  if (transaction.type === 'Income') {
    const result = buildIncome({
      id: transaction.id,
      date: transaction.date,
      description: transaction.description,
      amount: transaction.amount,
      account: transaction.paymentMethod === 'Voucher' ? 'voucher' : 'checking',
      category: transaction.category,
      ...(transaction.importId ? { importId: transaction.importId } : {}),
    })
    if (!result.ok) {
      skipped.push({ index, reason: result.reason })
      return
    }
    movements.push(result.value)
    return
  }

  const account =
    transaction.paymentMethod === 'Credit'
      ? 'card'
      : transaction.paymentMethod === 'Voucher Debit'
        ? 'voucher'
        : 'checking'
  const shares = (transaction.debts ?? [])
    .filter((debt) => debt.amount > 0)
    .map((debt) => ({ counterparty: debt.name, amount: debt.amount }))

  const installments =
    transaction.installments && transaction.installments > 1 ? transaction.installments : 1
  const result = buildPurchase({
    id: transaction.id,
    date: transaction.date,
    description: transaction.description,
    amount: transaction.amount,
    category: transaction.category,
    account,
    shares,
    installments,
    ...(transaction.importId ? { importId: transaction.importId } : {}),
  })
  if (!result.ok) {
    skipped.push({ index, reason: result.reason })
    return
  }
  movements.push(...result.value)

  const settled = (transaction.debts ?? []).filter((debt) => debt.settled && debt.amount > 0)
  settled.forEach((debt, debtIndex) => {
    const settlement = buildSettlement(
      {
        id: `${transaction.id}-settled-${debtIndex + 1}`,
        date: addMonthsToDate(transaction.date, installments - 1),
        description: `Received from ${debt.name}`,
        direction: 'receivable',
        counterparty: debt.name,
        received: debt.amount,
        forgiven: 0,
        account: 'checking',
        links: [transaction.id],
      },
      movements,
    )
    if (!settlement.ok) {
      skipped.push({ index, reason: settlement.reason })
      return
    }
    movements.push(settlement.value)
  })
}

function migrateLegacy(value: FinanceData): LedgerValidationResult {
  const movements: Movement[] = []
  const skippedMovements: { index: number; reason: string }[] = []
  for (let index = 0; index < value.transactions.length; index++) {
    migrateTransaction(value.transactions[index], index, movements, skippedMovements)
  }
  const validated = validateLedgerData({ movements, budgets: value.budgets })
  return {
    data: validated.data,
    skippedMovements: [...skippedMovements, ...validated.skippedMovements],
    skippedBudgets: validated.skippedBudgets,
  }
}

export function normalizeFinanceData(value: unknown): LedgerValidationResult {
  if (!isObject(value)) throw new Error('Invalid data: expected an object')

  if (Array.isArray(value.movements)) {
    return validateLedgerData({
      movements: value.movements,
      budgets: Array.isArray(value.budgets) ? value.budgets : [],
    })
  }

  if (Array.isArray(value.transactions)) {
    const legacy = validateFinanceData(value)
    const result = migrateLegacy(legacy.data)
    return {
      data: result.data,
      skippedMovements: [
        ...legacy.skippedTransactions.map((entry) => ({
          index: entry.index,
          reason: entry.reason,
        })),
        ...result.skippedMovements,
      ],
      skippedBudgets: legacy.skippedBudgets + result.skippedBudgets,
    }
  }

  throw new Error('Invalid data: expected movements or transactions')
}

export function toLedgerData(value: unknown): LedgerData {
  return normalizeFinanceData(value).data
}
