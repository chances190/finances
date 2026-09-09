import { v4 as uuid } from 'uuid'
import type { Budget, FinanceData, Transaction } from '../domain/entities'

function tx(refYear: number, refMonth: string, overrides: Partial<Transaction>): Transaction {
  return {
    id: uuid(),
    type: 'EXPENSE',
    date: `${refYear}-${refMonth}-01`,
    description: '',
    amount: 0,
    category: 'Other',
    paymentMethod: 'DEBIT',
    ...overrides,
  }
}

export function generateSeed(now: Date = new Date('2026-07-01')): FinanceData {
  const currentYear = now.getFullYear()
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0')
  const nextMonthNum = now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2
  const nextMonth = String(nextMonthNum).padStart(2, '0')
  const nextYear = now.getMonth() + 2 > 12 ? currentYear + 1 : currentYear

  const ym = `${currentYear}-${currentMonth}`

  const transactions: Transaction[] = [
    tx(currentYear, currentMonth, {
      type: 'INCOME',
      date: `${ym}-05`,
      description: 'Salary',
      amount: 5000,
      category: 'Salary',
      paymentMethod: 'DEBIT',
    }),
    tx(currentYear, currentMonth, {
      type: 'INCOME',
      date: `${ym}-05`,
      description: 'Meal Voucher',
      amount: 800,
      category: 'Salary',
      paymentMethod: 'MEAL_VOUCHER',
    }),

    tx(currentYear, currentMonth, {
      date: `${ym}-03`,
      description: 'Rent',
      amount: 1200,
      category: 'Rent',
      paymentMethod: 'DEBIT',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-02`,
      description: 'Supermarket',
      amount: 350,
      category: 'Food',
      paymentMethod: 'PIX',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-08`,
      description: 'Supermarket',
      amount: 120,
      category: 'Food',
      paymentMethod: 'DEBIT',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-15`,
      description: 'Supermarket',
      amount: 200,
      category: 'Food',
      paymentMethod: 'PIX',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-22`,
      description: 'Supermarket',
      amount: 180,
      category: 'Food',
      paymentMethod: 'DEBIT',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-04`,
      description: 'Bus pass',
      amount: 50,
      category: 'Transport',
      paymentMethod: 'PIX',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-10`,
      description: 'Gas',
      amount: 35,
      category: 'Transport',
      paymentMethod: 'PIX',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-17`,
      description: 'Gas',
      amount: 40,
      category: 'Transport',
      paymentMethod: 'DEBIT',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-23`,
      description: 'Uber',
      amount: 25,
      category: 'Transport',
      paymentMethod: 'PIX',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-06`,
      description: 'Dinner out',
      amount: 150,
      category: 'Leisure',
      paymentMethod: 'DEBIT',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-13`,
      description: 'Cinema',
      amount: 80,
      category: 'Leisure',
      paymentMethod: 'PIX',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-20`,
      description: 'Restaurant',
      amount: 200,
      category: 'Leisure',
      paymentMethod: 'CREDIT',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-10`,
      description: 'Electricity bill',
      amount: 150,
      category: 'Utilities',
      paymentMethod: 'DEBIT',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-15`,
      description: 'Water bill',
      amount: 80,
      category: 'Utilities',
      paymentMethod: 'PIX',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-12`,
      description: 'Pharmacy',
      amount: 200,
      category: 'Health',
      paymentMethod: 'DEBIT',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-18`,
      description: 'Clothes',
      amount: 350,
      category: 'Shopping',
      paymentMethod: 'CREDIT',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-25`,
      description: 'Online course',
      amount: 180,
      category: 'Education',
      paymentMethod: 'DEBIT',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-28`,
      description: 'Internet',
      amount: 120,
      category: 'Utilities',
      paymentMethod: 'DEBIT',
    }),

    tx(currentYear, currentMonth, {
      date: `${ym}-20`,
      description: 'Loan to João',
      amount: 200,
      category: 'Other',
      paymentMethod: 'PIX',
      debts: [{ name: 'João', amount: 200, settled: false }],
    }),

    // CREDIT INSTALLMENT: TV 12x R$300
    tx(currentYear, currentMonth, {
      date: `${ym}-15`,
      description: 'TV 12x',
      amount: 3600,
      category: 'Shopping',
      paymentMethod: 'CREDIT',
      installments: 12,
    }),
  ]

  const budgets: Budget[] = [
    {
      referenceMonth: ym,
      plannedIncome: 5000,
      plannedMealVoucher: 800,
      categoryLimits: {
        Food: 1000,
        Transport: 400,
        Rent: 1300,
        Leisure: 500,
        Utilities: 200,
        Health: 300,
        Shopping: 400,
        Education: 200,
      },
    },
    {
      referenceMonth: `${nextYear}-${nextMonth}`,
      plannedIncome: 5000,
      plannedMealVoucher: 800,
      categoryLimits: {
        Food: 1000,
        Transport: 400,
        Rent: 1300,
        Leisure: 500,
        Utilities: 200,
        Health: 300,
        Shopping: 400,
        Education: 200,
      },
    },
  ]

  return { transactions, budgets }
}
