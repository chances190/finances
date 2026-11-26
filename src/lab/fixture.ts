import type { Budget } from '@/domain/entities'
import type { Movement } from '@/domain/ledger'

function purchase(
  id: string,
  date: string,
  description: string,
  amount: number,
  account: 'checking' | 'card' | 'voucher' | 'cash',
  category: string,
): Movement {
  return {
    id,
    date,
    kind: 'purchase',
    description,
    postings: [
      { account: 'expense', amount, category },
      { account, amount: -amount },
    ],
  }
}

const november: Budget = {
  referenceMonth: '2026-11',
  plannedIncome: 5000,
  plannedMealVoucher: 600,
  investmentRate: 0.2,
  categoryLimits: { Food: 400, Fun: 200, Transport: 150, Tech: 250 },
}

export const richFixture: { movements: Movement[]; budgets: Budget[] } = {
  movements: [
    {
      id: 'salary-nov',
      date: '2026-11-05',
      kind: 'income',
      description: 'Salary · November',
      method: 'Salary',
      postings: [
        { account: 'checking', amount: 5000 },
        { account: 'income', amount: -5000, category: 'Salary' },
      ],
    },
    purchase('groceries', '2026-11-08', 'Groceries', 300, 'checking', 'Food'),
    purchase('cinema', '2026-11-12', 'Cinema', 100, 'card', 'Fun'),
    purchase('lunch', '2026-11-15', 'Lunch', 50, 'voucher', 'Food'),
    {
      id: 'shared-dinner',
      date: '2026-11-20',
      kind: 'purchase',
      description: 'Shared dinner',
      postings: [
        { account: 'expense', amount: 50, category: 'Food' },
        { account: 'receivable', amount: 50, counterparty: 'Ana' },
        { account: 'checking', amount: -100 },
      ],
    },
    {
      id: 'concert',
      date: '2026-11-18',
      kind: 'purchase',
      description: 'Concert ticket',
      postings: [
        { account: 'expense', amount: 30, category: 'Fun' },
        { account: 'payable', amount: -30, counterparty: 'Bob' },
      ],
    },
    purchase('tech-1', '2026-11-01', 'Headphones · 1/2', 200, 'card', 'Tech'),
    {
      ...purchase('tech-2', '2026-12-01', 'Headphones · 2/2', 200, 'card', 'Tech'),
      links: ['tech-1'],
    },
    {
      id: 'groceries-refund',
      date: '2026-11-22',
      kind: 'refund',
      description: 'Groceries · refund',
      postings: [
        { account: 'checking', amount: 50 },
        { account: 'expense', amount: -50, category: 'Food' },
      ],
      links: ['groceries'],
    },
    {
      id: 'ana-settlement',
      date: '2026-11-25',
      kind: 'settlement',
      description: 'Settled with Ana',
      postings: [
        { account: 'receivable', amount: -20, counterparty: 'Ana' },
        { account: 'checking', amount: 20 },
      ],
      links: ['shared-dinner'],
    },
    {
      id: 'voucher-transfer',
      date: '2026-11-23',
      kind: 'transfer',
      description: 'Top up voucher',
      postings: [
        { account: 'checking', amount: -100 },
        { account: 'voucher', amount: 100 },
      ],
    },
  ],
  budgets: [november],
}

const stressCategories = ['Food', 'Fun', 'Transport', 'Tech', 'Home', 'Health']
const stressAccounts = ['checking', 'card', 'voucher', 'cash'] as const
const stressNames = [
  'Groceries',
  'Coffee',
  'Pharmacy',
  'Bus fare',
  'Book shop',
  'Hardware store',
  'Lunch',
  'Streaming',
  'Taxi',
  'Bakery',
]

export function stressFixture(count = 1000): {
  movements: Movement[]
  budgets: Budget[]
} {
  const movements: Movement[] = []
  for (let index = 0; index < count; index++) {
    const month = String((index % 12) + 1).padStart(2, '0')
    const day = String((index % 27) + 1).padStart(2, '0')
    const amount = ((index * 37) % 24000) / 100 + 1
    movements.push(
      purchase(
        `stress-${index}`,
        `2026-${month}-${day}`,
        `${stressNames[index % stressNames.length]} ${index + 1}`,
        amount,
        stressAccounts[index % stressAccounts.length],
        stressCategories[index % stressCategories.length],
      ),
    )
  }
  return { movements, budgets: [november] }
}
