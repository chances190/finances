import { ACCOUNT_BADGE_COLORS } from '@/domain/constants'
import {
  ACCOUNT_LABELS,
  type Account,
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
  if (movement.kind === 'income' || movement.kind === 'refund') {
    return 'text-green-600 dark:text-green-400'
  }
  if (movement.kind === 'purchase') return 'text-red-600 dark:text-red-400'
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
  'Debit/PIX':
    'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/15 dark:text-teal-200 dark:border-teal-400/30',
  Credit:
    'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-200 dark:border-purple-400/30',
  'Voucher Debit':
    'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-500/15 dark:text-pink-200 dark:border-pink-400/30',
  Cash: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-400/30',
  Salary:
    'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-200 dark:border-yellow-400/30',
  Transfer:
    'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-200 dark:border-sky-400/30',
  'Voucher Income':
    'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-200 dark:border-orange-400/30',
  'Someone else':
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-400/30',
}

export { ACCOUNT_BADGE_COLORS }

export const ACCOUNT_BADGE_DARK: Record<Account, string> = {
  checking: 'dark:bg-teal-500/15 dark:text-teal-200 dark:border-teal-400/30',
  card: 'dark:bg-purple-500/15 dark:text-purple-200 dark:border-purple-400/30',
  voucher: 'dark:bg-pink-500/15 dark:text-pink-200 dark:border-pink-400/30',
  cash: 'dark:bg-sky-500/15 dark:text-sky-200 dark:border-sky-400/30',
  receivable: 'dark:bg-green-500/15 dark:text-green-200 dark:border-green-400/30',
  payable: 'dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-400/30',
  income: 'dark:bg-green-500/15 dark:text-green-200 dark:border-green-400/30',
  expense: 'dark:bg-red-500/15 dark:text-red-200 dark:border-red-400/30',
  forgiveness: 'dark:bg-violet-500/15 dark:text-violet-200 dark:border-violet-400/30',
  adjustment: 'dark:bg-slate-500/15 dark:text-slate-200 dark:border-slate-400/30',
}
