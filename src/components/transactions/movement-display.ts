import { ACCOUNT_BADGE_COLORS } from '@/domain/constants'
import {
  ACCOUNT_LABELS,
  CASH_ACCOUNTS,
  type DisplayPaymentMethod,
  expenseAmount,
  type FundingAccount,
  fundingAccountOf,
  grossPurchaseAmount,
  incomeAmount,
  MOVEMENT_KIND_LABELS,
  type Movement,
  movementTotal,
  type OutstandingMovement,
  paymentMethodOf,
  refundAmount,
  settlementTotal,
  transferAccounts,
} from '@/domain/ledger'
import { formatCurrency } from '@/lib/currency'

export function accountOf(movement: Movement): FundingAccount | null {
  if (movement.kind === 'transfer') {
    const accounts = transferAccounts(movement)
    return (accounts?.[0] as FundingAccount | undefined) ?? null
  }
  if (movement.kind === 'settlement') {
    const cash = movement.postings.find((posting) =>
      CASH_ACCOUNTS.includes(posting.account as (typeof CASH_ACCOUNTS)[number]),
    )
    return cash ? (cash.account as FundingAccount) : null
  }
  if (movement.kind === 'adjustment') {
    const posting = movement.postings.find((candidate) => candidate.account !== 'adjustment')
    return posting ? (posting.account as FundingAccount) : null
  }
  return fundingAccountOf(movement)
}

export function amountOf(movement: Movement): number {
  switch (movement.kind) {
    case 'purchase':
      return grossPurchaseAmount(movement)
    case 'income':
      return incomeAmount(movement)
    case 'refund':
      return refundAmount(movement)
    case 'settlement':
      return settlementTotal(movement)
    default:
      return movementTotal(movement)
  }
}

export function amountClass(movement: Movement): string {
  if (movement.kind === 'income' || movement.kind === 'refund') return 'text-green-600'
  if (movement.kind === 'purchase') return 'text-red-600'
  return 'text-muted-foreground'
}

export function paymentLabelOf(movement: Movement): string {
  const method = paymentMethodOf(movement)
  if (method) return method
  const account = accountOf(movement)
  return account ? ACCOUNT_LABELS[account] : '—'
}

export function kindLabelOf(movement: Movement): string | null {
  if (movement.kind === 'purchase' || movement.kind === 'income') return null
  if (movement.kind === 'settlement') {
    const relation = movement.postings.find(
      (posting) => posting.account === 'receivable' || posting.account === 'payable',
    )
    return relation?.account === 'receivable' ? 'Received' : 'Paid'
  }
  return MOVEMENT_KIND_LABELS[movement.kind]
}

export function debtStatusOf(rows: OutstandingMovement[]): 'Paid' | 'Partial' | null {
  if (rows.length === 0) return null
  if (rows.every((row) => row.outstanding <= 0.004)) return 'Paid'
  if (rows.some((row) => row.settled > 0.004)) return 'Partial'
  return null
}

export function detailOf(movement: Movement, debtRows: OutstandingMovement[]): string {
  if (movement.kind === 'transfer') {
    const accounts = transferAccounts(movement)
    if (accounts) return `${ACCOUNT_LABELS[accounts[0]]} → ${ACCOUNT_LABELS[accounts[1]]}`
  }
  if (movement.kind === 'purchase') {
    const shares = debtRows.filter((row) => row.direction === 'receivable')
    if (shares.length > 0) {
      const people = shares
        .map((row) => {
          const amount = formatCurrency(
            row.outstanding > 0.004 ? row.outstanding : row.total,
          ).replace(/ /g, '\u00A0')
          return `${row.counterparty} ${amount}${row.outstanding <= 0.004 ? '\u00A0(paid)' : ''}`
        })
        .join(' · ')
      return `You ${formatCurrency(expenseAmount(movement))} · ${people}`
    }
    const payable = debtRows.find((row) => row.direction === 'payable')
    if (payable) {
      return `Paid by ${payable.counterparty}${payable.outstanding <= 0.004 ? '\u00A0(paid)' : ''}`
    }
  }
  return ''
}

export const PAYMENT_BADGE_COLORS: Record<DisplayPaymentMethod, string> = {
  'Debit/PIX': 'bg-teal-100 text-teal-800',
  Credit: 'bg-purple-100 text-purple-800',
  'Voucher Debit': 'bg-pink-100 text-pink-800',
  Cash: 'bg-emerald-100 text-emerald-800',
  Salary: 'bg-yellow-100 text-yellow-800',
  Transfer: 'bg-sky-100 text-sky-800',
  'Voucher Income': 'bg-orange-100 text-orange-800',
  'Someone else': 'bg-amber-100 text-amber-800',
}

export { ACCOUNT_BADGE_COLORS }
