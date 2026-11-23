import type { Account } from './ledger'

export const SES_ALPHA = 0.3

export const DEFAULT_INVESTMENT_RATE = 0.2

export const ACCOUNT_BADGE_COLORS: Record<Account, string> = {
  checking: 'bg-teal-100 text-teal-800',
  card: 'bg-purple-100 text-purple-800',
  voucher: 'bg-pink-100 text-pink-800',
  cash: 'bg-sky-100 text-sky-800',
  receivable: 'bg-green-100 text-green-800',
  payable: 'bg-amber-100 text-amber-800',
  income: 'bg-green-100 text-green-800',
  expense: 'bg-red-100 text-red-800',
  forgiveness: 'bg-violet-100 text-violet-800',
  adjustment: 'bg-slate-100 text-slate-800',
}

export const CHART_COLORS = {
  income: '#22c55e',
  expense: '#ef4444',
  primary: '#3b82f6',
  warning: '#f59e0b',
  suggestion: '#8b5cf6',
  projection: '#f97316',
  balance: '#3b82f6',
  budgeted: '#3b82f6',
  actual: '#f59e0b',
}

export const CATEGORY_COLORS = [
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#a855f7',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
  '#84cc16',
  '#d946ef',
]
